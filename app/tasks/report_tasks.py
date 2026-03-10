from app.tasks.celery_app import celery_app
from app.services.report_service import ReportService


@celery_app.task(name="app.tasks.report_tasks.process_report_job")
def process_report_job(report_id: str) -> None:
    ReportService.process_report_job(report_id)
