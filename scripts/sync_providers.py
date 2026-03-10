from app.db.session import SessionLocal
from app.tasks.data_sync import run_provider_sync


def main() -> None:
    db = SessionLocal()
    try:
        results = run_provider_sync(db)
        for row in results:
            print(
                f"provider={row['provider']} processed={row['processed']} "
                f"succeeded={row['succeeded']} failed={row['failed']} status={row['status']}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
