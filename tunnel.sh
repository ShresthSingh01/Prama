#!/usr/bin/env bash
# ==============================================================================
# Prama - Fast Public HTTPS Tunnel Launcher (Cloudflare Quick Tunnel)
# ==============================================================================
echo "================================================================="
echo "         PRAMA | Launching Instant Public HTTPS Tunnel           "
echo "================================================================="
echo "Target: Exposing http://localhost:3000 (UI + API Reverse Proxy)"
echo "Anyone with this link can access Prama from anywhere in the world!"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
LOCAL_CLOUDFLARED="$BIN_DIR/cloudflared"

if command -v cloudflared &> /dev/null; then
    echo "[*] Using system Cloudflare Tunnel..."
    cloudflared tunnel --url http://localhost:3000
elif [ -f "$LOCAL_CLOUDFLARED" ]; then
    echo "[*] Using bundled Cloudflare binary..."
    chmod +x "$LOCAL_CLOUDFLARED"
    "$LOCAL_CLOUDFLARED" tunnel --url http://localhost:3000
elif command -v curl &> /dev/null && [ "$(uname)" = "Linux" ]; then
    echo "[*] Downloading official Cloudflare binary for Linux..."
    mkdir -p "$BIN_DIR"
    curl -L --output "$LOCAL_CLOUDFLARED" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x "$LOCAL_CLOUDFLARED"
    "$LOCAL_CLOUDFLARED" tunnel --url http://localhost:3000
elif command -v npx &> /dev/null; then
    echo "[*] Using LocalTunnel via npx..."
    npx localtunnel --port 3000
else
    echo "[*] Using Zero-Install Pinggy SSH Tunnel..."
    ssh -o StrictHostKeyChecking=no -p 443 -R0:localhost:3000 a.pinggy.io
fi
