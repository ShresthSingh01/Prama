# ==============================================================================
# Prama (AICTE FDR Intelligence Platform) - Production Docker Deployment Script (PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   PRAMA | AICTE Regulation Bureau Security Deposit Platform     " -ForegroundColor Cyan
Write-Host "                Production Deployment Script                     " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check Docker Installation
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Error: Docker is not installed or not in PATH. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# 2. Check or create .env
if (-not (Test-Path ".env")) {
    Write-Host "[*] Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# 3. Build and launch containers
Write-Host "[*] Building and starting Prama containers via Docker Compose..." -ForegroundColor Green
docker compose down --remove-orphans
docker compose build --pull
docker compose up -d

# 4. Wait for Backend Healthcheck
Write-Host "[*] Waiting for backend to become healthy..." -ForegroundColor Yellow
$maxRetries = 30
$count = 0
$isHealthy = $false

while ($count -lt $maxRetries) {
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($res.status -eq "healthy") {
            $isHealthy = $true
            Write-Host "[✓] Backend is online and healthy!" -ForegroundColor Green
            break
        }
    } catch {
        # Retry
    }
    $count++
    Start-Sleep -Seconds 2
}

if (-not $isHealthy) {
    Write-Host "[!] Warning: Backend healthcheck timed out. Inspect logs via 'docker compose logs backend'." -ForegroundColor Yellow
}

# 5. Output Access Information
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "               PRAMA IS LIVE AND OPERATIONAL!                    " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Frontend Cockpit:  http://localhost:3000" -ForegroundColor White
Write-Host "Backend API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "Health Endpoint:   http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "Demo Personas (Pre-seeded & Switchable in Top Navigation):" -ForegroundColor Yellow
Write-Host "  1. Scrutiny Officer (Maker):    maker@aicte.gov.in     / Password@123"
Write-Host "  2. Senior Director (Checker):   checker@aicte.gov.in   / Password@123"
Write-Host "  3. Regional Officer:            regional@aicte.gov.in  / Password@123"
Write-Host "  4. Technical College Admin:     college@apex.edu       / Password@123"
Write-Host "=================================================================" -ForegroundColor Cyan

