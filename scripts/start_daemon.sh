#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCRATCH_DIR="$PROJECT_DIR/scratch"
PID_FILE="$SCRATCH_DIR/daemon.pid"
LOG_FILE="$SCRATCH_DIR/daemon.log"
PORT=4041

mkdir -p "$SCRATCH_DIR" "$SCRATCH_DIR/runtime"

# Check if port 4041 is already running
if curl -s "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "✅ Velaris AI Daemon est DÉJÀ en cours d'exécution sur http://127.0.0.1:$PORT"
  curl -s "http://127.0.0.1:$PORT/health"
  echo ""
  exit 0
fi

echo "🚀 Lancement de Velaris AI Daemon sur le port $PORT..."
setsid python3 "$PROJECT_DIR/scripts/velaris_ai_daemon.py" > "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"
echo "📌 PID enregistré : $PID (Logs : $LOG_FILE)"

# Wait for daemon to become healthy
echo "⏳ Attente du pré-chauffage du worker resident..."
SUCCESS=0
for i in {1..20}; do
  if curl -s "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    SUCCESS=1
    break
  fi
  sleep 0.5
done

if [ $SUCCESS -eq 1 ]; then
  echo "✨ Velaris AI Daemon OPÉRATIONNEL sur http://127.0.0.1:$PORT !"
  curl -s "http://127.0.0.1:$PORT/health"
  echo ""
else
  echo "❌ Erreur au démarrage du daemon. Vérifiez les logs :"
  cat "$LOG_FILE" | tail -n 20
  exit 1
fi
