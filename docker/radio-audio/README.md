# 라디오 재생용 Lavalink

Lavalink 4.2.2 / Lavaplayer 2.2.6의 기본 HLS 처리는 MPEG-TS를 가정합니다. KBS 등의 AAC 세그먼트는 오디오 없이 종료되므로 `nm-hls` 플러그인이 세그먼트 헤더를 확인해 AAC, MPEG-TS, 초기화 파일이 있는 fragmented MP4를 각각 처리합니다. HTTP 소스가 켜져 있을 때만 등록되며 기존 HTTP 프록시 설정도 적용합니다.

iFM 서울 90.7의 마스터 재생목록은 `/live/...` 형태의 루트 상대경로를 반환합니다. 기존 라이브러리가 디렉터리를 중복해서 붙이던 부분을 표준 URI 해석으로 처리하고, `EXT-X-MAP` 초기화 파일을 MP4 세그먼트보다 먼저 읽습니다. 특정 방송 URL을 치환하는 방식은 아닙니다. 암호화, 바이트 범위 요청, 재생 도중 초기화 파일이 바뀌는 HLS는 지원하지 않습니다.

Compose에서 연결 및 연결 풀 대기는 10초, 응답 읽기는 30초로 설정합니다. HLS 라이브러리 내부의 별도 세그먼트 제한까지 변경하는 설정은 아닙니다. 응답하지 않는 방송 서버의 장애는 대기 시간을 늘려도 계속 발생할 수 있습니다.

제주MBC의 누락된 중간 인증서는 Java AIA 조회로 보완합니다. 조회 대상은 해당 GlobalSign 인증서 URL로 제한하고 인증서 검증은 유지합니다. 제주MBC 세그먼트 끝의 빈 MPEG-TS 패킷은 Lavaplayer 2.2.6에서 `BufferUnderflowException`을 일으키므로 디코더에 전달하기 전에 제외합니다. 오디오가 있는 패킷은 그대로 전달합니다.

EBS·안동MBC의 `NoHttpResponseException` 재시도와 제주MBC의 다음 세그먼트 HTTP 응답 오류를 줄이기 위해 `ebsonair.ebs.co.kr`, `live.andongmbc.co.kr`, `onairsfm.jejumbc.com`의 연결 재사용을 끕니다. 다른 호스트는 기존 연결 재사용 정책을 유지합니다. 안동MBC는 새 연결에서도 응답 시간 초과가 발생할 수 있습니다.

안동MBC는 Java 기본 TLS 설정에서 연결 후 읽기 시간 초과가 재현되어 해당 호스트에만 TLS 1.2를 사용합니다. TLS 1.2 비교 실행에서는 재생이 이어졌으며, 다른 호스트의 TLS 버전 선택과 기존 인증서·호스트명 검증은 유지합니다. 방송 서버의 모든 일시적 장애를 해결하는 설정은 아닙니다.

적용하려면 저장소를 업데이트한 뒤 Lavalink 이미지를 빌드하고 컨테이너를 다시 생성합니다. 단순 `restart`로는 이미지와 환경 변수 변경이 적용되지 않습니다.

```sh
docker compose up -d --build --no-deps lavalink
docker logs --since 2m lavalink
```

`data/lavalink/application.yml`의 `lavalink.server.sources.http`는 `true`여야 합니다. 봇의 일반 재생 명령어에는 기존 URL 제한이 계속 적용됩니다. Lavalink API는 인증된 내부 클라이언트만 접근하도록 운영해야 합니다.

회귀 테스트는 Docker와 FFmpeg가 설치된 환경에서 실행합니다. 합성한 사인파를 사용하므로 방송 서버나 Discord 연결이 필요하지 않습니다. 기본 처리의 AAC 재생 실패를 재현한 뒤 수정한 처리로 AAC·ID3 포함 AAC·MPEG-TS·빈 패킷이 포함된 MPEG-TS의 직접/마스터 재생목록에서 각각 두 세그먼트를 디코딩합니다. 로컬 프록시를 통해 세 방송 호스트의 연결 재사용 차단, 일반 호스트의 연결 재사용, 프록시 설정 적용도 확인합니다.

로컬 HTTPS 서버로 안동 호스트의 TLS 1.2, 일반 호스트의 TLS 1.3 협상과 잘못된 호스트명·신뢰하지 않는 인증서 거부도 확인합니다.

iFM 회귀 사례는 루트 상대경로·상위 디렉터리 상대경로·절대 URL·쿼리가 있는 URL, MP4 마스터/직접 재생목록과 명시적 `hls-inner` 경로를 실제 디코더로 확인합니다. 실제 iFM URL도 최종 이미지의 Java 17.0.18에서 6,000프레임을 20ms 간격으로 소비해 2분 이상 재생을 확인했습니다. 검증 기록은 `.omo/evidence/ifm-fix/`에 있습니다.

```sh
sh scripts/test-radio-audio.sh
```
