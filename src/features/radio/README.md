# 라디오 스트림 설정

방송국·주파수 목록은 `data/radio/stations.json`, 스트림 주소와 조회 방식은 `data/radio/streams.json`에서 관리합니다. 스트림 설정의 키는 방송국 ID이며, 현재 194개 항목을 포함합니다. 초기 정보는 [radio.bsod.kr 원본](https://github.com/BSofDeath/radio.bsod.kr/tree/main/functions/stream/url)을 참고했습니다.

봇은 로컬 JSON만 읽습니다. GitHub 조회와 원본 JavaScript 분석은 아래 유지보수 명령에서만 수행합니다.

```sh
bun run radio:sync
```

명령은 원본의 커밋을 고정해 읽고, 변경된 방송국 ID와 커밋을 출력하며 `data/radio/streams.proposed.json`을 생성합니다. 활성 설정은 덮어쓰지 않습니다. `--ref <커밋 또는 태그>`로 원본 버전을 지정할 수 있습니다. 지원하지 않는 원본 형식은 오류로 처리합니다.

제안 파일을 검토한 뒤 필요한 변경만 `streams.json`에 반영합니다. 방송국 추가·삭제나 주파수 변경은 `stations.json`도 함께 수정합니다. 두 JSON은 Docker 이미지에 포함되므로 배포 시 이미지를 다시 빌드해야 합니다. 정기 확인이 필요하면 외부 작업에서 이 명령을 실행하되, 활성 파일 반영은 검토 후 진행합니다.

| type | 처리 |
| --- | --- |
| `direct` | 고정 스트림 주소 사용 |
| `text` | API가 반환한 스트림 주소 사용 |
| `kbs` | 공식 API의 `channel_item[0].service_url` 사용 |
| `mbc-bora` | JSONP 응답의 `BoraURL` 사용 |
| `busan-mbc` | 한국 날짜를 `dateCodes`로 변환해 주소의 `{date}` 치환 |
| `afn` | API가 반환한 호스트에 설정된 `path` 결합 |

`radioStreamResolver.ts`는 이 설정에 따라 실제 주소를 구합니다. 만료되는 스트림 주소는 연결마다 다시 조회합니다. 방송국 ID로 로컬 설정을 조회하고 트랙에는 `nm-radio:<방송국 ID>`를 저장합니다. 이전 저장 데이터의 `radio.bsod.kr/stream` URL은 복원할 때만 로컬에서 ID로 변환하며 해당 사이트에는 요청하지 않습니다.

재시작 시 방송국별 조회를 먼저 병렬로 준비하며 전체 제한은 8초입니다. 이후 서버별 음성 연결·재생 복원에는 기존 3초 제한을 적용합니다. 실패한 저장 상태는 남겨두고, 취소된 조회는 이후 재생 요청으로 이어지지 않습니다.
