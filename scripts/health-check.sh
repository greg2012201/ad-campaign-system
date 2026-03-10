#!/usr/bin/env bash
set -euo pipefail

EXIT_CODE=0

check_service() {
  local name=$1
  local status
  status=$(docker compose ps --format json "$name" 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ "$status" = "healthy" ]; then
    echo "$name: healthy"
  else
    echo "$name: unhealthy ($status)"
    EXIT_CODE=1
  fi
}

check_service postgres
check_service redis
check_service mosquitto

exit $EXIT_CODE
