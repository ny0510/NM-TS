# NM

Discord.js, Shoukaku, Lavalink, Drizzle ORM으로 구성된 Bun 기반 음악 봇입니다. 프로젝트 골격은 [`caru-ini/discord-bot-template`](https://github.com/caru-ini/discord-bot-template)의 싱글턴 클라이언트, 동적 명령/이벤트 로더, Zod 환경 검증, Biome 품질 도구 구조를 따릅니다.

## 구조

```text
src/
├── index.ts          # 명령/이벤트 로드 후 Discord 로그인
├── client.ts         # NMClient 싱글턴과 서비스 조립
├── env.ts            # Zod 기반 환경 변수 경계
├── deploy.ts         # 수동 및 부팅 시 Slash Command 배포
├── commands/         # 22개 Slash Command
├── events/           # 6개 Discord 이벤트
├── features/         # 음악, 즐겨찾기, 차트, 분석 기능
├── managers/         # Lavalink, 상태 복원, 쿨다운, Koreanbots
├── db/               # Drizzle 스키마와 마이그레이션
├── shared/           # Discord 응답, 로깅, 포맷 공용 코드
└── utils/            # 동적 로더와 종료 처리
```

각 명령은 `export const command = {...} satisfies Command`, 각 이벤트는 `export const event = {...} satisfies Event` 형태로 내보냅니다. `src/utils/core.ts`가 이 모듈들을 자동으로 찾습니다.

## 실행

```bash
bun install
cp .env.example .env
bun run dev
```

TTY에서 개발 모드로 실행하면 템플릿의 하단 단축키 바가 활성화됩니다. `d`는 길드 명령어 동기화, `r`은 watch 재시작, `i`는 초대 링크 출력, `q`는 안전 종료이며 `Ctrl+L`은 로그 화면을 지웁니다.

Presence 갱신 주기와 초기 문구는 `.env`의 `PRESENCE_UPDATE_INTERVAL_MS`, `PRESENCE_INITIAL_MESSAGE`로 변경할 수 있습니다. 회전 문구는 `PRESENCE_MESSAGES` JSON 배열로 설정하며 `{guilds}`, `{users}`, `{players}` 자리표시자를 사용할 수 있습니다. `{players}`가 포함된 문구는 재생 중인 서버가 없을 때 자동으로 제외됩니다.

운영 실행은 `bun run start`를 사용합니다. Slash Command를 직접 동기화하려면 다음 명령을 사용합니다.

```bash
bun run deploy-commands --guild
bun run deploy-commands --global
bun run deploy-commands delete --guild
```

## 검증

```bash
bun run check
bun run typecheck
bun test
```

릴리스는 기존과 동일하게 `v*.*.*` 태그를 푸시할 때 GitHub Actions가 GHCR의 버전 태그와 `latest` 이미지를 생성합니다.
