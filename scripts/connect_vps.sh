#!/usr/bin/env bash
set -e

VPS_IP="162.35.113.220"
PORT=4041

echo "🌐 Connexion de Velaris Unified AI Gateway vers le VPS Contabo ($VPS_IP)..."

# Vérifier si le tunnel est déjà actif
if ssh -o ConnectTimeout=4 root@$VPS_IP "curl -s http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "✅ Le tunnel vers le VPS Contabo est DÉJÀ actif !"
  ssh root@$VPS_IP "curl -s http://127.0.0.1:$PORT/health"
  echo ""
  exit 0
fi

echo "🚀 Établissement du tunnel SSH sécurisé avec keepalive (Port $PORT ➔ VPS Contabo)..."
ssh -f -N -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ExitOnForwardFailure=yes -R 0.0.0.0:$PORT:127.0.0.1:$PORT root@$VPS_IP

sleep 2

# Vérification finale depuis le VPS
if ssh root@$VPS_IP "curl -s http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "✨ VPS Contabo relié avec succès à l'AI Gateway 0€ !"
  ssh root@$VPS_IP "curl -s http://127.0.0.1:$PORT/health"
  echo ""
else
  echo "❌ Erreur lors de la vérification du tunnel sur le VPS."
  exit 1
fi
