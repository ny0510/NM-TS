#!/bin/sh
set -eu

if ! bun run radio:sync; then
  if [ ! -s data/radio/stations.json ] || [ ! -s data/radio/streams.json ]; then
    echo '라디오 초기 설정을 생성하지 못해 봇을 시작할 수 없습니다.' >&2
    exit 1
  fi
  echo '라디오 동기화에 실패했습니다. 기존 설정으로 봇을 시작합니다.' >&2
fi

exec bun run src/index.ts
