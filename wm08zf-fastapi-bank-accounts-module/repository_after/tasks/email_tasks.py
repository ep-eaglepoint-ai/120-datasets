from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
    acks_late=True,
)
def send_account_created_email(self, user_email: str, payload: dict):
    """
    Idempotent, retry-safe background task.
    """
    task_id = f"{payload['user_id']}-{payload['account_number']}"
    logger.info("Sending account email", extra={"task_id": task_id})

    # send_email(...) ← SMTP or provider call
