from __future__ import annotations

import uuid
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import create_engine, create_sessionmaker, get_session
from .models import Base, Job, JobStatus, LoadedRow, ProcessingError
from .schemas import (
    HealthResponse,
    JobsListResponse,
    JobResponse,
    ProcessingErrorsListResponse,
    UploadResponse,
)
from .storage import job_storage_path, sanitize_filename, stream_upload_to_disk
from .tasks import check_redis_health, process_job


def _file_type_from_name(filename: str) -> str:
    parts = filename.rsplit(".", 1)
    if len(parts) != 2:
        return ""
    return parts[1].lower()


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = create_engine()
    app.state.engine = engine
    app.state.sessionmaker = create_sessionmaker(engine)

    # Initialize DB connections on startup via async context manager.
    try:
        async with engine.begin() as conn:
            # Ensure a connection can be acquired.
            await conn.execute(select(1))
            if settings.auto_create_db:
                await conn.run_sync(Base.metadata.create_all)

        yield
    finally:
        await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)


async def _persist_upload_and_enqueue(
    *,
    job_id: uuid.UUID,
    upload: UploadFile,
    dest,
    max_bytes: int,
    session_factory,
) -> None:
    try:
        # Persist to configured storage path in the background (after response).
        try:
            await upload.seek(0)
        except Exception:
            # If seek isn't supported, stream_upload_to_disk will read from current position.
            pass
        written = await stream_upload_to_disk(upload, dest, max_bytes)

        async with session_factory() as session:
            job = (
                await session.execute(select(Job).where(Job.id == job_id))
            ).scalar_one_or_none()
            if not job:
                return
            # In case file_size wasn't known precisely at creation time.
            job.file_size = int(written)
            await session.commit()

        # Enqueue background processing (Celery)
        if settings.celery_task_always_eager:
            from .tasks import _process_job_async

            await _process_job_async(str(job_id))
        else:
            process_job.delay(str(job_id))
    except HTTPException as exc:
        # Upload persistence failed (e.g., too large). Mark job FAILED.
        async with session_factory() as session:
            job = (
                await session.execute(select(Job).where(Job.id == job_id))
            ).scalar_one_or_none()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc.detail)
                job.completed_at = datetime.now(timezone.utc)
                await session.commit()
    except Exception as exc:  # noqa: BLE001
        async with session_factory() as session:
            job = (
                await session.execute(select(Job).where(Job.id == job_id))
            ).scalar_one_or_none()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = f"Failed to save upload: {exc}"
                job.completed_at = datetime.now(timezone.utc)
                await session.commit()
    finally:
        try:
            await upload.close()
        except Exception:
            pass


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    # Requirement: 400 for validation errors (instead of FastAPI default 422)
    return JSONResponse(status_code=400, content={"detail": exc.errors()})


@app.post("/api/files/upload", response_model=UploadResponse)
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    webhook_url: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
):
    filename = sanitize_filename(file.filename or "upload")
    file_type = _file_type_from_name(filename)
    if file_type not in {"csv", "xlsx", "xls"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    job_id = uuid.uuid4()
    dest = job_storage_path(str(job_id), filename)

    # Determine size without reading into memory.
    try:
        file.file.seek(0, 2)
        file_size = int(file.file.tell())
        file.file.seek(0)
    except Exception:
        # If we can't determine size quickly, we'll compute it during background persistence.
        file_size = 0

    if file_size and file_size > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File too large")

    job = Job(
        id=job_id,
        filename=filename,
        file_size=file_size,
        file_type=file_type,
        status=JobStatus.QUEUED,
        webhook_url=webhook_url,
        progress=0,
        rows_processed=0,
        rows_failed=0,
    )
    session.add(job)
    await session.commit()

    # Persist the upload to disk and enqueue processing in the background so the API
    # responds quickly even for large files.
    background_tasks.add_task(
        _persist_upload_and_enqueue,
        job_id=job_id,
        upload=file,
        dest=dest,
        max_bytes=settings.max_upload_bytes,
        session_factory=request.app.state.sessionmaker,
    )

    return UploadResponse(job_id=job_id)


@app.get("/api/jobs", response_model=JobsListResponse)
async def list_jobs(
    status: JobStatus | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
    session: AsyncSession = Depends(get_session),
):
    if page < 1 or page_size < 1 or page_size > 200:
        raise HTTPException(status_code=400, detail="Invalid pagination")

    base = select(Job)
    count_q = select(func.count()).select_from(Job)

    if status is not None:
        base = base.where(Job.status == status)
        count_q = count_q.where(Job.status == status)
    if from_date is not None:
        base = base.where(Job.created_at >= from_date)
        count_q = count_q.where(Job.created_at >= from_date)
    if to_date is not None:
        base = base.where(Job.created_at <= to_date)
        count_q = count_q.where(Job.created_at <= to_date)

    total = (await session.execute(count_q)).scalar_one()
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1

    q = (
        base.order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    jobs = (await session.execute(q)).scalars().all()

    return JobsListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        jobs=[JobResponse.model_validate(j) for j in jobs],
    )


@app.get("/api/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)


@app.get("/api/jobs/{job_id}/errors", response_model=ProcessingErrorsListResponse)
async def get_job_errors(
    job_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    session: AsyncSession = Depends(get_session),
):
    if page < 1 or page_size < 1 or page_size > 500:
        raise HTTPException(status_code=400, detail="Invalid pagination")

    job = (await session.execute(select(Job.id).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    count_q = select(func.count()).select_from(ProcessingError).where(ProcessingError.job_id == job_id)
    total = (await session.execute(count_q)).scalar_one()
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1

    q = (
        select(ProcessingError)
        .where(ProcessingError.job_id == job_id)
        .order_by(ProcessingError.row_number.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    errors = (await session.execute(q)).scalars().all()

    from .schemas import ProcessingErrorResponse

    return ProcessingErrorsListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        errors=[ProcessingErrorResponse.model_validate(e) for e in errors],
    )


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == JobStatus.PROCESSING:
        job.status = JobStatus.CANCELLED
        await session.commit()
        return Response(status_code=204)

    # Delete file and DB records
    path = job_storage_path(str(job_id), job.filename)
    try:
        path.unlink(missing_ok=True)
    except Exception:
        pass

    await session.execute(delete(Job).where(Job.id == job_id))
    await session.commit()

    return Response(status_code=204)


@app.post("/api/jobs/{job_id}/retry", response_model=JobResponse)
async def retry_job(job_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in {JobStatus.FAILED, JobStatus.CANCELLED}:
        raise HTTPException(status_code=400, detail="Job is not retryable")

    # Clear errors
    await session.execute(delete(ProcessingError).where(ProcessingError.job_id == job_id))
    await session.execute(delete(LoadedRow).where(LoadedRow.job_id == job_id))

    job.status = JobStatus.QUEUED
    job.progress = 0
    job.rows_processed = 0
    job.rows_failed = 0
    job.error_message = None
    job.started_at = None
    job.completed_at = None

    await session.commit()

    if settings.celery_task_always_eager:
        from .tasks import _process_job_async

        asyncio.create_task(_process_job_async(str(job_id)))
    else:
        process_job.delay(str(job_id))

    return JobResponse.model_validate(job)


@app.get("/api/health", response_model=HealthResponse)
async def health(request: Request, session: AsyncSession = Depends(get_session)):
    db_ok = False
    redis_ok = False
    details: dict[str, object] = {}

    try:
        await session.execute(select(1))
        db_ok = True
    except Exception as exc:  # noqa: BLE001
        details["db_error"] = str(exc)

    redis_ok = await check_redis_health(settings.redis_url)
    if not redis_ok:
        details["redis_error"] = "Redis ping failed"

    status = "healthy" if (db_ok and redis_ok) else "unhealthy"
    if status == "healthy":
        return HealthResponse(status=status, db=db_ok, redis=redis_ok, details=details)
    return JSONResponse(status_code=503, content=HealthResponse(status=status, db=db_ok, redis=redis_ok, details=details).model_dump())
