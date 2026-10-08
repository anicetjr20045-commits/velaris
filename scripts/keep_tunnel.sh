#!/usr/bin/env bash
# Watchdog automatique pour maintenir le tunnel SSH vers le VPS Contabo actif en permanence

VPS_IP="162.35.113.220"
PORT=4041
COACH_PORT=3002

while true; do
  # 1. Velaris AI Gateway (Port 4041)
  if ! ssh -o ConnectTimeout=4 -o BatchMode=yes root@$VPS_IP "curl -s -m 3 http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️ Tunnel VPS 4041 inactif ou coupé. Rétablissement..."
    pkill -f "ssh.*-R.*$PORT.*$VPS_IP" 2>/dev/null || true
    sleep 1
    ssh -f -N -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ExitOnForwardFailure=yes -R 0.0.0.0:$PORT:127.0.0.1:$PORT root@$VPS_IP 2>/dev/null || true
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Tentative de reconnexion 4041 effectuée."
  fi

  # 2. Mon Coach / The Edge (Port 3002 -> 3000)
  if ! ssh -o ConnectTimeout=4 -o BatchMode=yes root@$VPS_IP "curl -s -m 3 http://127.0.0.1:$COACH_PORT" >/dev/null 2>&1; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️ Tunnel VPS $COACH_PORT (The Edge) inactif ou coupé. Rétablissement..."
    pkill -f "ssh.*-R.*$COACH_PORT.*$VPS_IP" 2>/dev/null || true
    sleep 1
    ssh -o KexAlgorithms=curve25519-sha256 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ExitOnForwardFailure=yes -f -N -R 0.0.0.0:$COACH_PORT:127.0.0.1:3000 root@$VPS_IP 2>/dev/null || true
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Tentative de reconnexion $COACH_PORT effectuée."
  fi

  sleep 15
done
