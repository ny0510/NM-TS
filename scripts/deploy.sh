#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git pull --ff-only
git fetch --tags --force origin

NM_IMAGE_TAG="$(git tag --points-at HEAD --list 'v*.*.*' --sort=-version:refname | sed -n '1p')"
if [[ -z "$NM_IMAGE_TAG" ]]; then
  echo '현재 커밋에 해당하는 릴리스 태그가 없어 배포를 중단했어요.' >&2
  exit 1
fi
export NM_IMAGE_TAG

docker compose config --quiet
docker compose pull nm migrate
docker compose up -d --wait --no-recreate postgres lavalink
docker compose stop -t "${NM_STOP_TIMEOUT:-30}" nm
docker compose run --rm migrate
docker compose up -d --no-deps nm
docker compose ps nm postgres lavalink

for _ in {1..30}; do
  if docker compose logs --tail=100 nm 2>&1 | grep -q 'Ready! Logged in as'; then
    docker compose logs --tail=100 nm
    exit 0
  fi
  sleep 1
done

docker compose logs --tail=100 nm || true
echo 'NM 준비 완료 로그를 30초 안에 확인하지 못했어요.' >&2
exit 1
