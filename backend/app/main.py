import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.core.config import settings
from backend.app.models.database import engine, Base
from backend.app.models import entities  # Ensure models are loaded
from backend.app.api import (
    auth, instruments, verification, release,
    dashboard, graph, audit, demo, mock_bank, evaluation,
    slm, knowledge_api, copilot, reports, flags
)

# Auto-create tables if they don't exist
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.app.models.database import SessionLocal
    from backend.app.models.entities import User
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            print("[*] Database is empty. Running initial statutory seed for AICTE FDR Portal...")
            from backend.scripts.seed import seed_database
            seed_database(drop_existing=False)
            print("[✓] Initial seed completed successfully.")
    except Exception as e:
        print(f"[!] Startup seed check: {e}")
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Prama: Cryptographic Trust, Forensic Verification & Risk Intelligence for AICTE Regulation Bureau",
    lifespan=lifespan
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
if settings.CORS_ORIGINS:
    for o in settings.CORS_ORIGINS.split(","):
        cleaned = o.strip()
        if cleaned and cleaned not in origins:
            origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount storage directory for document / ELA previews
app.mount("/storage", StaticFiles(directory=settings.STORAGE_DIR), name="storage")

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(instruments.router, prefix=settings.API_V1_PREFIX)
app.include_router(verification.router, prefix=settings.API_V1_PREFIX)
app.include_router(release.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(graph.router, prefix=settings.API_V1_PREFIX)
app.include_router(audit.router, prefix=settings.API_V1_PREFIX)
app.include_router(demo.router, prefix=settings.API_V1_PREFIX)
app.include_router(mock_bank.router, prefix=settings.API_V1_PREFIX)
app.include_router(evaluation.router, prefix=settings.API_V1_PREFIX)
app.include_router(slm.router, prefix=settings.API_V1_PREFIX)
app.include_router(knowledge_api.router, prefix=settings.API_V1_PREFIX)
app.include_router(copilot.router, prefix=settings.API_V1_PREFIX)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX)
app.include_router(flags.router, prefix=settings.API_V1_PREFIX)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "demo_mode": settings.DEMO_MODE
    }

@app.get("/")
def root():
    return {
        "message": "Prama Intelligence Platform API Online",
        "docs": "/docs",
        "api_v1": settings.API_V1_PREFIX
    }
