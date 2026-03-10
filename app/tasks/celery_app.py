from celery import Celery

from app.config import get_settings

settings = get_settings()

broker = settings.celery_broker_url or settings.redis_url
backend = settings.celery_result_backend or settings.redis_url

celery_app = Celery("milki", broker=broker, backend=backend)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Africa/Dar_es_Salaam",
    enable_utc=True,
    task_track_started=True,
)

celery_app.autodiscover_tasks(["app.tasks"])
