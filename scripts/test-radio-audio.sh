#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null
command -v docker >/dev/null
mkdir -p "$PWD/.cache"
work_dir=$(mktemp -d "$PWD/.cache/radio-audio-test.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM

ffmpeg -v error -f lavfi -i sine=frequency=440:sample_rate=44100 -t 2 -c:a aac -b:a 64k -f adts "$work_dir/tone.aac"
ffmpeg -v error -f lavfi -i sine=frequency=440:sample_rate=44100 -t 2 -c:a aac -b:a 64k -streamid 0:256 -f mpegts "$work_dir/tone.ts"
mkdir "$work_dir/mp4"
ffmpeg -v error -f lavfi -i sine=frequency=440:sample_rate=44100 -t 4 -c:a aac -b:a 64k -f hls -hls_time 2 -hls_segment_type fmp4 "$work_dir/mp4/playlist.m3u8"
docker build --target plugin-builder -t nm-radio-test-builder:4.2.2 docker/radio-audio
docker run --rm \
  -v "$work_dir:/fixtures:ro" \
  -v "$PWD/src/test/docker/radio-audio:/tests:ro" \
  nm-radio-test-builder:4.2.2 sh -ec '
    mkdir -p /tmp/test-classes
    javac --release 17 -cp "classes:BOOT-INF/classes:BOOT-INF/lib/*" -d /tmp/test-classes /tests/*.java
    keytool -genkeypair -alias test -keyalg RSA -keystore /tmp/test.p12 -storepass test-only -dname CN=radio-test -ext SAN=dns:live.andongmbc.co.kr,dns:ordinary.invalid -validity 1 >/dev/null 2>&1
    java -cp "/tmp/test-classes:classes:BOOT-INF/classes:BOOT-INF/lib/*" kr.nm.hls.RadioTlsTest /tmp/test.p12
    java -cp "/tmp/test-classes:classes:BOOT-INF/classes:BOOT-INF/lib/*" kr.nm.hls.RadioAudioTest /fixtures
    java -cp "/tmp/test-classes:classes:BOOT-INF/classes:BOOT-INF/lib/*" kr.nm.hls.IfmHlsTest /fixtures
  '
