"""CLI interface for worker management."""
from __future__ import annotations

import argparse
import asyncio
import signal
import sys
import time
from typing import Optional

from .client import TaskQueue
from .models import Job, JobResult, JobStatus, Priority
from .worker import GracefulShutdown, WorkerNode, WorkerProcess


def create_parser() -> argparse.ArgumentParser:
    """Create the CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="taskqueue",
        description="Distributed Task Queue CLI",
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Worker command
    worker_parser = subparsers.add_parser("worker", help="Start a worker process")
    worker_parser.add_argument(
        "--name",
        type=str,
        default="worker",
        help="Worker name",
    )
    worker_parser.add_argument(
        "--concurrency",
        type=int,
        default=10,
        help="Maximum concurrent jobs",
    )
    worker_parser.add_argument(
        "--heartbeat-interval",
        type=float,
        default=10.0,
        help="Heartbeat interval in seconds",
    )
    
    # Submit command
    submit_parser = subparsers.add_parser("submit", help="Submit a job")
    submit_parser.add_argument("name", type=str, help="Job name")
    submit_parser.add_argument(
        "--payload",
        type=str,
        default="{}",
        help="Job payload as JSON string",
    )
    submit_parser.add_argument(
        "--priority",
        type=str,
        choices=["critical", "high", "normal", "low", "batch"],
        default="normal",
        help="Job priority",
    )
    submit_parser.add_argument(
        "--delay",
        type=int,
        default=0,
        help="Delay in milliseconds",
    )
    
    # Status command
    status_parser = subparsers.add_parser("status", help="Get queue status")
    
    # Inspect command
    inspect_parser = subparsers.add_parser("inspect", help="Inspect a job")
    inspect_parser.add_argument("job_id", type=str, help="Job ID to inspect")
    
    # Cancel command
    cancel_parser = subparsers.add_parser("cancel", help="Cancel a job")
    cancel_parser.add_argument("job_id", type=str, help="Job ID to cancel")
    
    return parser


def priority_from_string(s: str) -> Priority:
    """Convert string to Priority enum."""
    mapping = {
        "critical": Priority.CRITICAL,
        "high": Priority.HIGH,
        "normal": Priority.NORMAL,
        "low": Priority.LOW,
        "batch": Priority.BATCH,
    }
    return mapping.get(s.lower(), Priority.NORMAL)


def run_worker(args: argparse.Namespace):
    """Run a worker process."""
    import json
    
    queue = TaskQueue()
    
    def default_handler(job: Job) -> JobResult:
        """Default job handler that just logs the job."""
        print(f"Processing job: {job.id} - {job.name}")
        time.sleep(0.1)
        return JobResult(
            job_id=job.id,
            success=True,
            result={"processed": True},
        )
    
    worker = WorkerProcess(
        name=args.name,
        handler=default_handler,
        max_concurrent=args.concurrency,
        heartbeat_interval=args.heartbeat_interval,
    )
    
    queue.register_worker(worker)
    worker.start()
    
    shutdown = GracefulShutdown(
        worker.node,
        queue._worker_registry,
        on_job_reassign=lambda job: queue._priority_queue.enqueue(job),
    )
    
    def signal_handler(signum, frame):
        print("\nShutdown requested...")
        shutdown.request_shutdown()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print(f"Worker {worker.info.id} started ({args.name})")
    print(f"Concurrency: {args.concurrency}")
    
    try:
        while worker.is_running and not shutdown.is_shutdown_requested():
            job = queue.get_next_job(timeout=1.0)
            if job:
                worker.node.assign_job(job)
                
                async def process():
                    result = await worker.process_job(job)
                    queue.complete_job(job.id, result)
                    worker.node.complete_job(job.id, result.success)
                
                asyncio.run(process())
            
            queue.worker_heartbeat(worker.info.id)
    
    finally:
        print("Executing graceful shutdown...")
        unfinished = shutdown.execute_shutdown(timeout_seconds=30)
        if unfinished:
            print(f"Reassigned {len(unfinished)} unfinished jobs")
        print("Worker stopped")


def submit_job(args: argparse.Namespace):
    """Submit a job via CLI."""
    import json
    
    queue = TaskQueue()
    
    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON payload: {args.payload}")
        sys.exit(1)
    
    priority = priority_from_string(args.priority)
    
    job_id = queue.submit(
        name=args.name,
        payload=payload,
        priority=priority,
        delay_ms=args.delay,
    )
    
    print(f"Job submitted: {job_id}")


def show_status(args: argparse.Namespace):
    """Show queue status."""
    queue = TaskQueue()
    stats = queue.get_stats()
    
    print("Queue Status")
    print("=" * 40)
    print(f"Total Jobs:     {stats.total_jobs}")
    print(f"Pending:        {stats.pending_jobs}")
    print(f"Running:        {stats.running_jobs}")
    print(f"Completed:      {stats.completed_jobs}")
    print(f"Failed:         {stats.failed_jobs}")
    print(f"Dead (DLQ):     {stats.dead_jobs}")
    print(f"Avg Time (ms):  {stats.avg_processing_time_ms:.2f}")


def inspect_job(args: argparse.Namespace):
    """Inspect a specific job."""
    queue = TaskQueue()
    job = queue.get_job(args.job_id)
    
    if not job:
        print(f"Job not found: {args.job_id}")
        sys.exit(1)
    
    print(f"Job: {job.id}")
    print("=" * 40)
    print(f"Name:       {job.name}")
    print(f"Status:     {job.status}")
    print(f"Priority:   {Priority(job.priority).name}")
    print(f"Attempt:    {job.attempt}")
    print(f"Created:    {job.created_at}")
    if job.started_at:
        print(f"Started:    {job.started_at}")
    if job.completed_at:
        print(f"Completed:  {job.completed_at}")
    if job.last_error:
        print(f"Last Error: {job.last_error}")


def cancel_job(args: argparse.Namespace):
    """Cancel a job."""
    queue = TaskQueue()
    
    if queue.cancel_job(args.job_id):
        print(f"Job cancelled: {args.job_id}")
    else:
        print(f"Could not cancel job: {args.job_id}")
        sys.exit(1)


def main():
    """Main CLI entry point."""
    parser = create_parser()
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    commands = {
        "worker": run_worker,
        "submit": submit_job,
        "status": show_status,
        "inspect": inspect_job,
        "cancel": cancel_job,
    }
    
    handler = commands.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
