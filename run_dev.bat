@echo off
title AICTE Prama Launcher
echo ==========================================================
echo   AICTE REGULATION BUREAU - PRAMA PLATFORM
echo   Smart India Hackathon (SIH PS 26265)
echo ==========================================================

set ROOT=%~dp0

echo [*] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Prama Backend" cmd /k "cd /d "%ROOT%" && set PYTHONPATH=. && .venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [*] Starting Next.js Frontend on http://localhost:3000 ...
start "Prama Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo ==========================================================
echo   SYSTEM READY!
echo   Terminal UI : http://localhost:3000
echo   API Engine  : http://127.0.0.1:8000
echo   OpenAPI Docs: http://127.0.0.1:8000/docs
echo ==========================================================
