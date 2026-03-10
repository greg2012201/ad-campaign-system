#!/usr/bin/env bash
set -euo pipefail

docker compose down -v

echo "Infrastructure stopped and volumes removed."
