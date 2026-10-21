# 라디오 재생용 Lavalink

Lavalink 4.2.2 / Lavaplayer 2.2.6의 기본 HLS 처리는 MPEG-TS를 가정합니다. KBS 등의 AAC 세그먼트는 오디오 없이 종료되므로 `nm-hls` 플러그인이 세그먼트 헤더를 확인해 AAC와 MPEG-TS를 각각 처리합니다. HTTP 소스가 켜져 있을 때만 등록되며 기존 HTTP 프록시 설정도 적용합니다.

Compose에서 연결 및 연결 풀 대기는 10초, 응답 읽기는 30초로 설정합니다. HLS 라이브러리 내부의 별도 세그먼트 제한까지 변경하는 설정은 아닙니다. 응답하지 않는 방송 서버의 장애는 대기 시간을 늘려도 계속 발생할 수 있습니다.

제주MBC의 누락된 중간 인증서는 Java AIA 조회로 보완합니다. 조회 대상은 해당 GlobalSign 인증서 URL로 제한하고 인증서 검증은 유지합니다.

EBS는 기존 HTTP 연결을 재사용할 때 `NoHttpResponseException`과 재시도가 반복되어 `ebsonair.ebs.co.kr`에만 연결 재사용을 끕니다. 안동MBC처럼 방송 서버 자체가 장시간 응답하지 않는 경우는 별도로 남을 수 있습니다.

적용하려면 저장소를 업데이트한 뒤 Lavalink 이미지를 빌드하고 컨테이너를 다시 생성합니다. 단순 `restart`로는 이미지와 환경 변수 변경이 적용되지 않습니다.

```sh
docker compose up -d --build --no-deps lavalink
docker logs --since 2m lavalink
```

`data/lavalink/application.yml`의 `lavalink.server.sources.http`는 `true`여야 합니다. 봇의 일반 재생 명령어에는 기존 URL 제한이 계속 적용됩니다. Lavalink API는 인증된 내부 클라이언트만 접근하도록 운영해야 합니다.

회귀 테스트는 Docker와 FFmpeg가 설치된 환경에서 실행합니다. 합성한 사인파를 사용하므로 방송 서버나 Discord 연결이 필요하지 않습니다. 기본 처리의 AAC 재생 실패를 재현한 뒤 수정한 처리로 AAC·ID3 포함 AAC·MPEG-TS의 직접/마스터 재생목록에서 각각 두 세그먼트를 디코딩합니다. 로컬 프록시를 통해 EBS 요청의 연결 재사용 여부와 프록시 설정 적용도 확인합니다.

```sh
sh scripts/test-radio-audio.sh
```
