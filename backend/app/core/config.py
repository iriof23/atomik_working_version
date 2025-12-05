"""
Configuration management for dual-mode deployment
"""
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings supporting both desktop and docker modes"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Deployment mode
    DEPLOYMENT_MODE: Literal["desktop", "docker"] = "desktop"
    
    # Application
    APP_NAME: str = "PenTest Report Generator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "file:./pentest.db"  # SQLite for desktop, PostgreSQL for docker
    DATABASE_SSL_MODE: str = "prefer"  # disable, prefer, require, verify-ca, verify-full
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_TIMEOUT: int = 30
    
    # Security
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # License validation (desktop mode)
    LICENSE_VALIDATION_URL: str = "https://api.example.com/validate"
    LICENSE_PUBLIC_KEY: str = ""  # RSA public key for license verification
    GRACE_PERIOD_DAYS: int = 30
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost", "http://localhost:80", "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1", "http://127.0.0.1:80"]
    
    # File storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set[str] = {
        "png", "jpg", "jpeg", "gif", "pdf", "xml", "nessus", "txt"
    }
    
    # S3 storage (docker mode)
    USE_S3: bool = False
    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    
    # Redis (docker mode)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Celery (docker mode)
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # CVE enrichment
    NVD_API_KEY: str = ""
    NVD_API_URL: str = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # or "text"
    
    # Backup
    BACKUP_DIR: str = "./backups"
    BACKUP_RETENTION_DAYS: int = 30
    BACKUP_ENCRYPTION_ENABLED: bool = True
    
    @property
    def is_desktop_mode(self) -> bool:
        """Check if running in desktop mode"""
        return self.DEPLOYMENT_MODE == "desktop"
    
    @property
    def is_docker_mode(self) -> bool:
        """Check if running in docker mode"""
        return self.DEPLOYMENT_MODE == "docker"


# Global settings instance
settings = Settings()
