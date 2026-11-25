import base64
import hashlib
import numpy as np
from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet() -> Fernet:
    raw_secret = getattr(settings, "BIOMETRIC_ENCRYPTION_KEY", "") or settings.SECRET_KEY
    digest = hashlib.sha256(f"attendx-biometric-v1:{raw_secret}".encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def encrypt_embedding(embedding: np.ndarray) -> tuple[bytes, str]:
    """
    Serializes a float32 facial embedding vector, computes its SHA-256 checksum,
    and encrypts it at rest using Fernet (AES-128-CBC + HMAC-SHA256).
    """
    arr = np.asarray(embedding, dtype=np.float32).flatten()
    raw_bytes = arr.tobytes()
    checksum = hashlib.sha256(raw_bytes).hexdigest()
    token = _get_fernet().encrypt(raw_bytes)
    return token, checksum


def decrypt_embedding(encrypted_bytes: bytes, expected_checksum: str = "") -> np.ndarray:
    """
    Decrypts an encrypted facial embedding template and verifies its integrity checksum.
    """
    raw_bytes = _get_fernet().decrypt(bytes(encrypted_bytes))
    if expected_checksum:
        actual = hashlib.sha256(raw_bytes).hexdigest()
        if actual != expected_checksum:
            raise ValueError("Biometric template integrity check failed.")
    return np.frombuffer(raw_bytes, dtype=np.float32).copy()

