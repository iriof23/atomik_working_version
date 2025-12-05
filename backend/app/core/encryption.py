"""
Field-Level Encryption for Sensitive Data

SECURITY: This module provides encryption for sensitive database fields.
Uses AES-256-GCM for authenticated encryption.

Use cases:
- Client contact information (email, phone)
- Notes containing sensitive findings
- API keys and tokens
- PII data

Usage:
    from app.core.encryption import encrypt_field, decrypt_field
    
    # Encrypt before storing
    encrypted = encrypt_field("sensitive data")
    
    # Decrypt when reading
    decrypted = decrypt_field(encrypted)
"""
import os
import base64
import logging
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

from app.core.config import settings

logger = logging.getLogger(__name__)

# Encryption constants
NONCE_SIZE = 12  # 96 bits for GCM
KEY_SIZE = 32    # 256 bits for AES-256
SALT_SIZE = 16   # 128 bits for key derivation


class FieldEncryption:
    """
    AES-256-GCM encryption for database fields.
    
    SECURITY: 
    - Uses authenticated encryption (GCM mode) to prevent tampering
    - Unique nonce per encryption for semantic security
    - Key derived from SECRET_KEY using PBKDF2
    """
    
    def __init__(self, secret_key: Optional[str] = None):
        """
        Initialize with a secret key.
        
        Args:
            secret_key: Base secret key (defaults to settings.SECRET_KEY)
        """
        self._secret_key = secret_key or settings.SECRET_KEY
        self._encryption_key: Optional[bytes] = None
        self._salt: Optional[bytes] = None
    
    def _derive_key(self, salt: bytes) -> bytes:
        """
        Derive an encryption key from the secret using PBKDF2.
        
        SECURITY: PBKDF2 with high iteration count makes brute force attacks
        computationally expensive.
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=KEY_SIZE,
            salt=salt,
            iterations=100000,  # High iteration count for security
            backend=default_backend()
        )
        return kdf.derive(self._secret_key.encode())
    
    def _get_encryption_key(self) -> tuple[bytes, bytes]:
        """
        Get or create the encryption key.
        
        Returns:
            (key, salt) tuple
        """
        if self._encryption_key is None:
            # Use a fixed salt derived from the secret key for consistency
            # This ensures the same key is derived each time
            self._salt = self._secret_key[:SALT_SIZE].encode().ljust(SALT_SIZE, b'\x00')
            self._encryption_key = self._derive_key(self._salt)
        
        return self._encryption_key, self._salt
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a string value.
        
        Args:
            plaintext: The string to encrypt
            
        Returns:
            Base64-encoded encrypted value (format: nonce + ciphertext)
            
        SECURITY: Each encryption uses a unique random nonce, so encrypting
        the same plaintext twice produces different ciphertexts.
        """
        if not plaintext:
            return plaintext
        
        try:
            key, _ = self._get_encryption_key()
            aesgcm = AESGCM(key)
            
            # Generate unique nonce for this encryption
            nonce = os.urandom(NONCE_SIZE)
            
            # Encrypt (GCM mode provides authentication)
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
            
            # Combine nonce + ciphertext and encode as base64
            encrypted = base64.b64encode(nonce + ciphertext).decode('utf-8')
            
            # Prefix with marker to identify encrypted fields
            return f"$enc${encrypted}"
            
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise ValueError("Failed to encrypt data")
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt an encrypted string value.
        
        Args:
            ciphertext: Base64-encoded encrypted value (with $enc$ prefix)
            
        Returns:
            Decrypted plaintext string
            
        Raises:
            ValueError: If decryption fails (tampered data, wrong key, etc.)
        """
        if not ciphertext:
            return ciphertext
        
        # Check if this is an encrypted field
        if not ciphertext.startswith("$enc$"):
            # Not encrypted, return as-is (backwards compatibility)
            return ciphertext
        
        try:
            key, _ = self._get_encryption_key()
            aesgcm = AESGCM(key)
            
            # Remove prefix and decode
            encrypted_data = base64.b64decode(ciphertext[5:])  # Skip "$enc$"
            
            # Split nonce and ciphertext
            nonce = encrypted_data[:NONCE_SIZE]
            actual_ciphertext = encrypted_data[NONCE_SIZE:]
            
            # Decrypt (GCM verifies authentication tag)
            plaintext = aesgcm.decrypt(nonce, actual_ciphertext, None)
            
            return plaintext.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError("Failed to decrypt data - data may be corrupted or tampered")
    
    def is_encrypted(self, value: str) -> bool:
        """Check if a value is encrypted (has $enc$ prefix)."""
        return value is not None and value.startswith("$enc$")


# Global instance
_field_encryption: Optional[FieldEncryption] = None


def get_field_encryption() -> FieldEncryption:
    """Get the global field encryption instance."""
    global _field_encryption
    if _field_encryption is None:
        _field_encryption = FieldEncryption()
    return _field_encryption


def encrypt_field(value: str) -> str:
    """
    Encrypt a field value.
    
    Usage:
        encrypted_email = encrypt_field(client.email)
    """
    return get_field_encryption().encrypt(value)


def decrypt_field(value: str) -> str:
    """
    Decrypt a field value.
    
    Usage:
        email = decrypt_field(encrypted_email)
    """
    return get_field_encryption().decrypt(value)


def is_encrypted(value: str) -> bool:
    """Check if a value is encrypted."""
    return get_field_encryption().is_encrypted(value)


class EncryptedFieldMixin:
    """
    Mixin for Pydantic models with encrypted fields.
    
    Usage:
        class ClientCreate(EncryptedFieldMixin, BaseModel):
            email: str
            phone: str
            
            _encrypted_fields = ['email', 'phone']
    """
    _encrypted_fields: list = []
    
    def encrypt_sensitive_fields(self) -> dict:
        """Return dict with sensitive fields encrypted."""
        data = self.model_dump() if hasattr(self, 'model_dump') else self.dict()
        for field in self._encrypted_fields:
            if field in data and data[field]:
                data[field] = encrypt_field(data[field])
        return data
    
    @classmethod
    def decrypt_sensitive_fields(cls, data: dict) -> dict:
        """Decrypt sensitive fields in a dict."""
        for field in cls._encrypted_fields:
            if field in data and data[field]:
                data[field] = decrypt_field(data[field])
        return data

