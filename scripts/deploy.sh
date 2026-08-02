#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git pull --ff-only
docker compose config --quiet
docker compose pull nm migrate
docker compose up -d --wait --no-recreate postgres lavalink
docker compose stop -t "${NM_STOP_TIMEOUT:-30}" nm
docker compose run --rm migrate
docker compose up -d --no-deps nm
docker compose ps nm postgres lavalink
docker compose logs --tail=100 nm
