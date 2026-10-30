# ==============================================================================
# Prama - High-Speed Ngrok Public HTTPS Tunnel Launcher (India Edge)
# ==============================================================================
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "       PRAMA | Launching High-Speed Ngrok HTTPS Tunnel           " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Target: Exposing http://localhost:3000 (UI + API Reverse Proxy)" -ForegroundColor Yellow
Write-Host "Routing: Lowest-Latency Edge (Auto-Optimized)" -ForegroundColor Green
Write-Host ""

$binDir = Join-Path $PSScriptRoot "bin"
$ngrokExe = Join-Path $binDir "ngrok.exe"
$configPath = Join-Path $env:LOCALAPPDATA "ngrok\ngrok.yml"

if (-not (Test-Path $ngrokExe)) {
    Write-Host "[!] ngrok.exe not found in bin directory." -ForegroundColor Red
    exit 1
}

# Check if authtoken is configured
$hasAuthToken = $false
if (Test-Path $configPath) {
    $content = Get-Content $configPath -Raw
    if ($content -match "authtoken:") {
        $hasAuthToken = $true
    }
}

if (-not $hasAuthToken) {
    Write-Host "-----------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "  First-time Setup Required: Ngrok Auth Token" -ForegroundColor Yellow
    Write-Host "-----------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "1. Go to: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor White
    Write-Host "2. Sign up or log in (100% Free)" -ForegroundColor White
    Write-Host "3. Copy your AuthToken" -ForegroundColor White
    Write-Host ""
    
    $token = Read-Host "Paste your Ngrok authtoken here (or press Enter to cancel)"
    if ($token -and $token.Trim() -ne "") {
        & $ngrokExe config add-authtoken $token.Trim()
        Write-Host "[+] Authtoken saved successfully!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "[!] No token provided. Exiting." -ForegroundColor Red
        exit 1
    }
}

# Check if local frontend server is running on port 3000
$isAppRunning = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect("127.0.0.1", 3000, $null, $null)
    $success = $iar.AsyncWaitHandle.WaitOne(800, $false)
    if ($success -and $tcp.Connected) {
        $tcp.EndConnect($iar)
        $isAppRunning = $true
    }
    $tcp.Close()
} catch {}

if (-not $isAppRunning) {
    Write-Host "=================================================================" -ForegroundColor Yellow
    Write-Host "[!] NOTICE: Local app is NOT running on port 3000 yet!" -ForegroundColor Yellow
    Write-Host "    Ngrok forwards traffic to http://127.0.0.1:3000." -ForegroundColor White
    Write-Host "    If your app is not running, visiting the link gives 502 Bad Gateway." -ForegroundColor White
    Write-Host "    --> Please start the app first using: .\run_dev.ps1 or run_dev.bat" -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[*] Starting Ngrok Tunnel on http://127.0.0.1:3000..." -ForegroundColor Green
Write-Host "[i] Press Ctrl+C in this window anytime to stop the tunnel." -ForegroundColor Cyan
Write-Host ""

& $ngrokExe http 127.0.0.1:3000 --host-header="rewrite"
