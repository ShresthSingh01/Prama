import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "FDR-Sentinel"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database: SQLite with WAL mode by default; easily switches to postgresql://...
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/fdr_sentinel.db")
    
    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "aicte_fdr_sentinel_super_secret_jwt_key_2026_sih")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Storage
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", str(BASE_DIR / "storage_vault"))
    
    # Demo & Regulatory Clock
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure storage vault exists
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "documents"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "ela"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "qrs"), exist_ok=True)
