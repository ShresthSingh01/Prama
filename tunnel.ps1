# ==============================================================================
# Prama - Fast Public HTTPS Tunnel Launcher (Cloudflare Quick Tunnel)
# ==============================================================================
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "         PRAMA | Launching Instant Public HTTPS Tunnel           " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Target: Exposing http://localhost:3000 (UI + API Reverse Proxy)" -ForegroundColor Yellow
Write-Host "Anyone with this link can access Prama from anywhere in the world!" -ForegroundColor Green
Write-Host ""

$binDir = Join-Path $PSScriptRoot "bin"
$localCloudflared = Join-Path $binDir "cloudflared.exe"

if (-not (Test-Path $localCloudflared) -and -not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "[*] cloudflared not found locally. Downloading official Cloudflare binary..." -ForegroundColor Yellow
    if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
    try {
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $localCloudflared -UseBasicParsing
        Write-Host "[✓] Download complete!" -ForegroundColor Green
    } catch {
        Write-Host "[!] Could not auto-download cloudflared. Falling back..." -ForegroundColor Yellow
    }
}

if (Test-Path $localCloudflared) {
    Write-Host "[*] Launching Cloudflare Tunnel ($localCloudflared)..." -ForegroundColor Green
    & $localCloudflared tunnel --url http://localhost:3000
} elseif (Get-Command cloudflared -ErrorAction SilentlyContinue) {
    Write-Host "[*] Launching system Cloudflare Tunnel..." -ForegroundColor Green
    cloudflared tunnel --url http://localhost:3000
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "[*] Starting LocalTunnel via npx fallback..." -ForegroundColor Yellow
    npx localtunnel --port 3000
} else {
    Write-Host "[*] Starting Zero-Install Pinggy SSH Tunnel fallback..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no -p 443 -R0:localhost:3000 a.pinggy.io
}
