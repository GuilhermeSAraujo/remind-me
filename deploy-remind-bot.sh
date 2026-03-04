#!/usr/bin/env bash
set -euo pipefail

IMAGE="remind-bot:latest"

echo "Pulling latest changes"
git pull origin main

echo "Building image: $IMAGE"
docker build -t "$IMAGE" .

echo "Restarting services"
docker compose down
find ./userDataDir -name "SingletonLock" -delete 2>/dev/null || true
find ./userDataDir -name "SingletonCookie" -delete 2>/dev/null || true  
find ./userDataDir -name "SingletonSocket" -delete 2>/dev/null || true
docker compose up -d