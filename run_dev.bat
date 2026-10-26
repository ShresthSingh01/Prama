@echo off
title AICTE FDR-Sentinel Launcher
echo ==========================================================
echo   AICTE REGULATION BUREAU - FDR-SENTINEL PLATFORM
echo   Smart India Hackathon (SIH PS 26265)
echo ==========================================================

set ROOT=%~dp0

echo [*] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "FDR-Sentinel Backend" cmd /k "cd /d "%ROOT%" && set PYTHONPATH=. && .venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [*] Starting Next.js Frontend on http://localhost:3000 ...
start "FDR-Sentinel Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo ==========================================================
echo   SYSTEM READY!
echo   Terminal UI : http://localhost:3000
echo   API Engine  : http://127.0.0.1:8000
echo   OpenAPI Docs: http://127.0.0.1:8000/docs
echo ==========================================================
