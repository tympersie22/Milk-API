import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings
from app.core.exceptions import ApiError


settings = get_settings()


def _fernet_key() -> bytes:
    raw = settings.pii_encryption_key.encode("utf-8")
    digest = hashlib.sha256(raw).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_text(plaintext: str) -> bytes:
    fernet = Fernet(_fernet_key())
    return fernet.encrypt(plaintext.encode("utf-8"))


def decrypt_text(ciphertext: bytes) -> str:
    fernet = Fernet(_fernet_key())
    try:
        return fernet.decrypt(ciphertext).decode("utf-8")
    except InvalidToken as exc:
        raise ApiError(status_code=500, code="PII_DECRYPT_FAILED", message="Unable to decrypt owner data") from exc
