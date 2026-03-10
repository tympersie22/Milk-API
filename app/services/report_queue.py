from app.config import get_settings
from app.services.report_service import ReportService


settings = get_settings()


def enqueue_report_job(report_id: str, bind=None) -> str:
    """Queue report job via Celery; optionally fallback inline for local/dev reliability."""
    try:
        from app.tasks.report_tasks import process_report_job

        process_report_job.delay(report_id)
        return "queued"
    except Exception:
        if not settings.report_queue_fallback_inline:
            raise
        ReportService.process_report_job(report_id, bind=bind)
        return "inline"
