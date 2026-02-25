#!/usr/bin/env bash
set -euo pipefail

IMAGE="registry.local:5000/remind-bot:latest"
STACK="remind-bot"

echo "Building image: $IMAGE"
docker build -t "$IMAGE" .

echo "Pushing image: $IMAGE"
docker push "$IMAGE"

docker stack rm "$STACK"

echo "Deploying stack: $STACK"
docker stack deploy -c docker-stack.yml "$STACK"