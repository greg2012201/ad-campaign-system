#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting infrastructure (Docker)..."
"$SCRIPT_DIR/infra-up.sh"
echo ""

echo "Building shared package..."
pnpm --filter @campaign-system/shared run build
echo ""

echo "Starting all dev services..."
echo ""

pnpm exec concurrently \
  --names "shared,api,ui,screen" \
  --prefix-colors "yellow,blue,green,magenta" \
  --prefix "{time} [{name}]" \
  --timestampFormat "HH:mm:ss" \
  --kill-others-on-fail \
  "pnpm --filter @campaign-system/shared run dev" \
  "pnpm --filter backend run start:dev" \
  "pnpm --filter @campaign-system/admin-ui run dev" \
  "pnpm --filter screen-client run dev"
