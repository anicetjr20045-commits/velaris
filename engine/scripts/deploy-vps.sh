#!/usr/bin/env bash
set -euo pipefail

echo "==> 1. Compilation TypeScript de l'Engine..."
cd /root/projets/velaris/engine
npm run build

echo "==> 2. Construction de l'image Docker velaris-engine:latest..."
docker build -t velaris-engine:latest .

echo "==> 3. Redémarrage du conteneur dans docker-compose..."
cd /root/waha-vps-setup
docker compose up -d --force-recreate velaris-engine

echo "==> 4. Vérification de l'état..."
docker ps --filter "name=velaris-engine"
echo "Déploiement terminé avec succès !"
