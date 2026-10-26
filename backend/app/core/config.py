import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
# Load .env from root or backend directory
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")
load_dotenv(".env")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Prama"
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

    # LLM & SLM Provider Configuration
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "auto")  # auto, gemini, ollama, null
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
    GEMINI_RPM_LIMIT: int = int(os.getenv("GEMINI_RPM_LIMIT", "15"))
    GEMINI_MAX_RETRIES: int = int(os.getenv("GEMINI_MAX_RETRIES", "3"))
    SLM_BASE_URL: str = os.getenv("SLM_BASE_URL", "http://localhost:11434")
    SLM_MODEL: str = os.getenv("SLM_MODEL", "qwen2.5:3b")
    SLM_ENABLED: bool = os.getenv("SLM_ENABLED", "true").lower() in ("true", "1", "yes")
    SLM_TIMEOUT_SECONDS: int = int(os.getenv("SLM_TIMEOUT_SECONDS", "30"))
    SLM_TEMPERATURE: float = float(os.getenv("SLM_TEMPERATURE", "0.0"))

    # Knowledge & PageIndex Sources
    KNOWLEDGE_DIR: str = os.getenv("KNOWLEDGE_DIR", str(BASE_DIR.parent / "knowledge"))
    KNOWLEDGE_SOURCES_DIR: str = os.getenv("KNOWLEDGE_SOURCES_DIR", str(BASE_DIR.parent / "knowledge_sources"))

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure storage vault exists
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "documents"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "ela"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "qrs"), exist_ok=True)
