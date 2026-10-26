# FDR-Sentinel One-Click Launcher for Windows
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AICTE REGULATION BUREAU - FDR-SENTINEL PLATFORM" -ForegroundColor Yellow
Write-Host "  Smart India Hackathon (SIH PS 26265)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# 1. Launch FastAPI Backend in a separate window
Write-Host "[*] Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$backendCmd = "cd '$root'; `$env:PYTHONPATH='.'; .\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# 2. Launch Next.js Frontend in a separate window
Write-Host "[*] Starting Next.js Frontend on http://localhost:3000 ..." -ForegroundColor Cyan
$frontendCmd = "cd '$root\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  SYSTEM READY!" -ForegroundColor Green
Write-Host "  Terminal UI : http://localhost:3000" -ForegroundColor Yellow
Write-Host "  API Engine  : http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "  OpenAPI Docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
