#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is required (Docker Desktop Compose v2)."
  echo "Install/enable it, then rerun: npm run infra:up"
  exit 1
fi

docker compose up -d
