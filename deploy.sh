#!/usr/bin/env bash
# ==============================================================================
# Prama (AICTE FDR Intelligence Platform) - Production Docker Deployment Script
# ==============================================================================
set -e

echo "================================================================="
echo "   PRAMA | AICTE Regulation Bureau Security Deposit Platform     "
echo "                Production Deployment Script                     "
echo "================================================================="

# 1. Check Docker Installation
if ! command -v docker &> /dev/null; then
    echo "[!] Error: Docker is not installed. Please install Docker and Docker Compose."
    exit 1
fi

# 2. Check or create .env
if [ ! -f .env ]; then
    echo "[*] Creating .env from .env.example..."
    cp .env.example .env
fi

# 3. Build and launch containers
echo "[*] Building and starting Prama containers via Docker Compose..."
docker compose down --remove-orphans || true
docker compose build --pull
docker compose up -d

# 4. Wait for Backend Healthcheck
echo "[*] Waiting for backend to become healthy..."
MAX_RETRIES=30
COUNT=0
while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8000/health | grep -q "healthy"; then
        echo "[✓] Backend is online and healthy!"
        break
    fi
    COUNT=$((COUNT+1))
    sleep 2
done

if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "[!] Warning: Backend healthcheck timed out. Check logs with 'docker compose logs backend'."
fi

# 5. Output Access Information
echo ""
echo "================================================================="
echo "               PRAMA IS LIVE AND OPERATIONAL!                    "
echo "================================================================="
echo "Frontend Cockpit:  http://localhost:3000"
echo "Backend API Docs:  http://localhost:8000/docs"
echo "Health Endpoint:   http://localhost:8000/health"
echo ""
echo "Demo Personas (Pre-seeded & Switchable in Top Navigation):"
echo "  1. Scrutiny Officer (Maker):    maker@aicte.gov.in     / Password@123"
echo "  2. Senior Director (Checker):   checker@aicte.gov.in   / Password@123"
echo "  3. Regional Officer:            regional@aicte.gov.in  / Password@123"
echo "  4. Technical College Admin:     college@apex.edu       / Password@123"
echo "================================================================="

