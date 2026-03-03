#!/usr/bin/env bash
set -euo pipefail

IMAGE="remind-bot:latest"

echo "Pulling latest changes"
git pull origin main

echo "Building image: $IMAGE"
docker build -t "$IMAGE" .

echo "Restarting services"
docker compose down
docker compose up -d