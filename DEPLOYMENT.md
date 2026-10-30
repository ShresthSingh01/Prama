# Prama: Production Deployment Guide

This guide provides end-to-end instructions for deploying **Prama (AICTE Regulation Bureau Security Deposit & FDR Intelligence Platform)** across production environments.

---

## 1. Quick Start: 1-Command Docker Deployment (Recommended)

Prama includes a production-ready, multi-stage Dockerized setup orchestrating both the **FastAPI Backend (Python 3.12)** and **Next.js 14 Frontend** with zero external dependencies required.

### On Linux / macOS:
```bash
chmod +x deploy.sh
./deploy.sh
```

### On Windows (PowerShell):
```powershell
.\deploy.ps1
```

### Or using Standard Docker Compose:
```bash
docker compose up --build -d
```

### What This Does:
1. Builds a minimal Python 3.12 slim backend container.
2. Builds an optimized Next.js standalone runner container (<150MB).
3. Connects both services on a private Docker bridge network (`prama-network`).
4. Persists the SQLite database and PDF storage vault in Docker volumes (`prama_data`, `prama_storage`).
5. Checks health endpoints and verifies readiness.

---

## 2. Production Service URLs & Access Points

| Service | Port | Production URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Cockpit** | `3000` | `http://localhost:3000` | AICTE Officer & College Web Cockpit |
| **Backend API** | `8000` | `http://localhost:8000` | Core FastAPI Services |
| **Interactive Docs** | `8000` | `http://localhost:8000/docs` | Swagger OpenAPI Documentation |
| **Health Check** | `8000` | `http://localhost:8000/health` | Container & Service Liveness Probe |

---

## 3. Pre-Seeded Officer & Institutional Credentials

All official roles are pre-seeded in the database and accessible via the **Active Persona Selector** in the top navigation bar or manual login:

| Role | Email | Password | Permissions & Regulatory Scope |
| :--- | :--- | :--- | :--- |
| **Scrutiny Officer (Maker)** | `maker@aicte.gov.in` | `Password@123` | Tier 1 scrutiny, document verification, flag resolution |
| **Senior Director (Checker)** | `checker@aicte.gov.in` | `Password@123` | Tier 2 authorization, Clause 6.46 release certificates |
| **Regional Officer (Vigilance)**| `regional@aicte.gov.in` | `Password@123` | Multi-state syndicate investigation, bank notice issuance |
| **Technical College Admin** | `college@apex.edu` | `Password@123` | Institutional FDR submission, renewal & release applications |

---

## 4. Environment Variables Reference

Create a `.env` file in the project root (copied from `.env.example`):

```bash
# -----------------------------------------------------------------------------
# Core Server & Security
# -----------------------------------------------------------------------------
SECRET_KEY=generate_a_secure_random_hex_string_in_production
DEMO_MODE=true                      # Set to false to disable simulated time machine in production

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------
# Embedded SQLite with WAL mode (Default):
DATABASE_URL=sqlite:///./backend/fdr_sentinel.db

# Or Enterprise PostgreSQL:
# DATABASE_URL=postgresql://prama_user:strong_password@postgres_host:5432/prama_db

# -----------------------------------------------------------------------------
# AI & Intelligence Providers
# -----------------------------------------------------------------------------
# Primary Online LLM (Google Gemini):
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
GEMINI_MODEL=gemini-3-flash-preview
LLM_PROVIDER=auto                   # Options: "auto", "gemini", "ollama", "null"

# Local Sovereign SLM (Offline Ollama Fallback):
SLM_BASE_URL=http://localhost:11434
SLM_MODEL=qwen2.5:3b
SLM_ENABLED=true

# -----------------------------------------------------------------------------
# Frontend API Gateway
# -----------------------------------------------------------------------------
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 5. Cloud Platform Deployments

### A. Deploying on Render (via Blueprint)
1. Push this repository to GitHub or GitLab.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** $\to$ **Blueprint**.
4. Select your Prama repository.
5. Render reads [`render.yaml`](file:///d:/SIH2nd/render.yaml) and automatically provisions:
   - `prama-backend` (Python web service running FastAPI).
   - `prama-frontend` (Node.js web service running Next.js standalone).
6. Set `GEMINI_API_KEY` under the backend environment settings.

---

### B. Deploying on Railway
1. Install the Railway CLI or connect via GitHub on [railway.app](https://railway.app).
2. Create a new project and select **Deploy from GitHub repo**.
3. Railway detects [`railway.json`](file:///d:/SIH2nd/railway.json) and builds the container.
4. Add the frontend service pointing `NEXT_PUBLIC_API_URL` to your backend's public domain.

---

### C. Deploying on Ubuntu / Debian VPS (systemd + Nginx)

#### 1. System Packages:
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nodejs npm nginx curl
```

#### 2. Backend Setup:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

#### 3. Backend systemd service (`/etc/systemd/system/prama-backend.service`):
```ini
[Unit]
Description=Prama FastAPI Regulatory Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/SIH2nd
Environment="PYTHONPATH=/home/ubuntu/SIH2nd"
ExecStart=/home/ubuntu/SIH2nd/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

#### 4. Frontend Setup:
```bash
cd frontend
npm ci
npm run build
```

#### 5. Frontend systemd service (`/etc/systemd/system/prama-frontend.service`):
```ini
[Unit]
Description=Prama Next.js Frontend Cockpit
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/SIH2nd/frontend
ExecStart=/usr/bin/npm start -- -p 3000
Restart=always

[Install]
WantedBy=multi-user.target
```

#### 6. Nginx Reverse Proxy Configuration (`/etc/nginx/sites-available/prama`):
```nginx
server {
    listen 80;
    server_name aicte-fdr.yourdomain.gov.in;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Vault Storage Previews
    location /storage/ {
        proxy_pass http://127.0.0.1:8000/storage/;
    }
}
```
Enable with:
```bash
sudo ln -s /etc/nginx/sites-available/prama /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## 6. Verifying the Production Deployment

Run the automated test suite against the deployment:
```bash
pytest backend/tests/ -v
```
All **29/29 tests** must pass, confirming:
- Ed25519 cryptographic bank signature verification.
- Tamper-evident Merkle hash chain integrity.
- AICTE APH Clause 6.46 dual-officer Maker-Checker release gates.
- Statutory CSV report generation (RFC 4180).
- Natural language smart search parsing.
- Independent external bank confirmation portal (`/bank-verify/[token]`).

