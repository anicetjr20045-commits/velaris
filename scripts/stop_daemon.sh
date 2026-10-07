#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCRATCH_DIR="$PROJECT_DIR/scratch"
PID_FILE="$SCRATCH_DIR/daemon.pid"
PORT=4041

echo "🛑 Arrêt de Velaris AI Daemon (Port $PORT)..."

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Envoi du signal SIGTERM au PID $PID..."
    kill -15 "$PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

# Clean any process still occupying port 4041
PIDS_ON_PORT=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$PIDS_ON_PORT" ]; then
  echo "Nettoyage des processus résiduels sur le port $PORT : $PIDS_ON_PORT"
  kill -9 $PIDS_ON_PORT 2>/dev/null || true
fi

echo "✅ Velaris AI Daemon arrêté avec succès."
