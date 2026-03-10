#!/usr/bin/env bash
set -euo pipefail

docker compose up -d

echo "Waiting for services to be healthy..."

docker compose wait --down-timeout 30s postgres redis mosquitto 2>/dev/null || \
  timeout 30 bash -c '
    until docker compose ps --format json | grep -q "healthy"; do
      sleep 2
    done
  ' 2>/dev/null || true

sleep 3

echo ""
docker compose ps
echo ""
echo "Infrastructure is up."
