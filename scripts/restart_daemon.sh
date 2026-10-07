#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "🔄 Redémarrage de Velaris Unified AI Gateway..."
bash "$SCRIPT_DIR/stop_daemon.sh"
sleep 1
bash "$SCRIPT_DIR/start_daemon.sh"
echo "✅ Gateway redémarrée avec succès."
