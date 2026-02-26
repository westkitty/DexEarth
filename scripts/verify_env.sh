#!/usr/bin/env bash
# Verify that the local .env is configured correctly before starting the dev server.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"
OK=true

if [ ! -f "$ENV_FILE" ]; then
  echo "⚠  .env not found — copy .env.example and fill in your values:"
  echo "   cp .env.example .env"
  echo ""
  echo "   The app will still run but THERMAL_FIRES will show UNAVAILABLE."
  exit 0
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [ -z "${VITE_FIRMS_MAP_KEY:-}" ] || [ "$VITE_FIRMS_MAP_KEY" = "YOUR_KEY_HERE" ]; then
  echo "ℹ  VITE_FIRMS_MAP_KEY is not set — THERMAL_FIRES layer will be UNAVAILABLE."
  echo "   Get a free key at: https://firms.modaps.eosdis.nasa.gov/api/map_key/"
else
  echo "✓  VITE_FIRMS_MAP_KEY is set."
fi

if [ "$OK" = true ]; then
  echo "✓  Environment OK."
fi
