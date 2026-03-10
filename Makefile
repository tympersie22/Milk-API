.PHONY: setup dev test lint format migrate seed

setup:
	python -m pip install -e ".[dev]"

dev:
	uvicorn app.main:app --reload --port 8000

test:
	pytest tests/ -v --cov=app --cov-report=term-missing

lint:
	ruff check app tests
	mypy app

format:
	ruff format app tests

migrate:
	alembic upgrade head

seed:
	python scripts/seed_data.py
