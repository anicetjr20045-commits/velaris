#!/usr/bin/env bash
# Watchdog automatique pour maintenir le tunnel SSH vers le VPS Contabo actif en permanence

VPS_IP="162.35.113.220"
PORT=4041

while true; do
  if ! ssh -o ConnectTimeout=4 -o BatchMode=yes root@$VPS_IP "curl -s -m 3 http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️ Tunnel VPS inactif ou coupé. Rétablissement..."
    pkill -f "ssh.*-R.*$PORT.*$VPS_IP" 2>/dev/null || true
    sleep 1
    ssh -f -N -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ExitOnForwardFailure=yes -R 0.0.0.0:$PORT:127.0.0.1:$PORT root@$VPS_IP 2>/dev/null || true
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Tentative de reconnexion effectuée."
  fi
  sleep 30
done
