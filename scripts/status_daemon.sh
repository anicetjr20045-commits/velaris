#!/usr/bin/env bash
PORT=4041

echo "🔍 Statut de Velaris AI Daemon (Port $PORT) :"
if curl -s -f "http://127.0.0.1:$PORT/health"; then
  echo ""
  echo "✅ Le service est actif et répond parfaitement."
else
  echo "❌ Le service n'est pas joignable sur http://127.0.0.1:$PORT."
fi
