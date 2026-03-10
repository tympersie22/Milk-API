#!/usr/bin/env python3
"""
One-time migration script: re-encrypt all PII data after switching
from SHA256 to PBKDF2 key derivation.

Usage:
    # Dry run (shows what would be updated, changes nothing):
    python scripts/migrate_encryption_key.py --dry-run

    # Execute the migration:
    python scripts/migrate_encryption_key.py --execute

Requires the OLD PII_ENCRYPTION_KEY in an env var so both old and new
Fernet keys can be derived.  The current PII_ENCRYPTION_KEY in .env is
used for re-encryption.

    OLD_PII_ENCRYPTION_KEY=<old-key> python scripts/migrate_encryption_key.py --execute
"""

import argparse
import base64
import hashlib
import os
import sys

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select, text

# Ensure project root is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import get_settings
from app.db.session import SessionLocal


settings = get_settings()


# ---------- old key derivation (SHA256) ----------
def _old_fernet_key(raw_key: str) -> bytes:
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def decrypt_old(ciphertext: bytes, old_key: str) -> str:
    fernet = Fernet(_old_fernet_key(old_key))
    return fernet.decrypt(ciphertext).decode("utf-8")


# ---------- new key derivation (PBKDF2) ----------
_SALT = b"milki-pii-encryption-v1"


def _new_fernet_key(raw_key: str) -> bytes:
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password=raw_key.encode("utf-8"),
        salt=_SALT,
        iterations=600_000,
    )
    return base64.urlsafe_b64encode(derived)


def encrypt_new(plaintext: str, new_key: str) -> bytes:
    fernet = Fernet(_new_fernet_key(new_key))
    return fernet.encrypt(plaintext.encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-encrypt PII after key derivation change")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    group.add_argument("--execute", action="store_true", help="Apply the re-encryption")
    args = parser.parse_args()

    old_key = os.environ.get("OLD_PII_ENCRYPTION_KEY")
    new_key = settings.pii_encryption_key

    if not old_key:
        print("ERROR: Set OLD_PII_ENCRYPTION_KEY env var to the key used before the PBKDF2 upgrade.")
        sys.exit(1)

    # Check if old and new keys produce the same Fernet key (no migration needed)
    if _old_fernet_key(old_key) == _new_fernet_key(new_key):
        print("Old and new derived keys are identical — nothing to migrate.")
        return

    db = SessionLocal()
    try:
        # Migrate ownerships.owner_name_encrypted
        rows = db.execute(
            text("SELECT id, owner_name_encrypted FROM ownerships WHERE owner_name_encrypted IS NOT NULL")
        ).fetchall()

        print(f"Found {len(rows)} ownership record(s) to re-encrypt.")

        success = 0
        failed = 0
        for row in rows:
            try:
                plaintext = decrypt_old(row.owner_name_encrypted, old_key)
                new_ciphertext = encrypt_new(plaintext, new_key)

                if args.dry_run:
                    print(f"  [DRY RUN] Would re-encrypt ownership {row.id}")
                else:
                    db.execute(
                        text("UPDATE ownerships SET owner_name_encrypted = :enc WHERE id = :id"),
                        {"enc": new_ciphertext, "id": row.id},
                    )
                success += 1
            except InvalidToken:
                # Already encrypted with new key, or corrupted
                print(f"  [SKIP] ownership {row.id} — could not decrypt with old key (may already be migrated)")
                failed += 1

        if not args.dry_run:
            db.commit()
            print(f"\nMigration complete: {success} re-encrypted, {failed} skipped.")
        else:
            print(f"\nDry run complete: {success} would be re-encrypted, {failed} would be skipped.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
