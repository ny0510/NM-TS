# UTILS KNOWLEDGE BASE

## OVERVIEW

Shared helper functions and configurations for Music, Discord interactions, and text formatting.

## STRUCTURE

```
src/utils/
├── music/
│   ├── playerUtils.ts            # Barrel re-export (유틸리티 전체 재export)
│   ├── playerValidation.ts       # 음성 채널/플레이어 검증 (ensureVoiceChannel, ensurePlayerReady 등)
│   ├── trackAdder.ts             # 트랙 추가 로직 + 필터 + 임베드 메타 (addTrackToQueue, getEmbedMeta)
│   ├── queueOperations.ts        # 대기열 파괴 + 진행 바 (destroyQueueSafely, createProgressBar)
│   ├── lavalinkEvents.ts         # 플레이어/노드 이벤트 핸들러
│   ├── index.ts                  # 모듈 진입점
│   └── buttons/
│       ├── controlsButton.ts     # 플레이어 컨트롤 버튼 핸들러
│       ├── quickAddButton.ts     # 빠른 추가 버튼 핸들러
│       └── quickAddButtonComponent.ts  # 순수 UI 컴포넌트 (로직 분리)
├── discord/
│   ├── client.ts                 # getClient() 헬퍼
│   ├── embeds.ts                 # createErrorEmbed (replyError 제거됨)
│   ├── mention.ts                # 멘션 유틸
│   ├── index.ts
│   ├── interactions/
│   │   ├── safeReply.ts          # 지연/응답 상태 안전한 reply
│   │   ├── interactionManager.ts # 인터랙션 관리
│   │   └── index.ts
│   └── permissions/
│       ├── checkPermissions.ts   # 권한 검사
│       ├── formatPermissions.ts  # 권한 포맷팅
│       ├── basicPermissions.ts   # 기본 권한 정의
│       ├── locale/permission.ts  # 권한 한국어 로케일
│       └── index.ts
├── formatting/
│   ├── format.ts                 # Duration/Date 포맷팅
│   ├── patterns.ts               # 정규식 패턴
│   └── index.ts
├── autocomplete/
│   └── googleSuggest.ts          # Google Suggest 연동
├── logger.ts                     # Logger 클래스 (ILogger 구현)
└── config.ts                     # 환경변수 로딩
```

## WHERE TO LOOK

| Task                | Location                            | Notes                                 |
| ------------------- | ----------------------------------- | ------------------------------------- |
| **음성 채널 검증**  | `music/playerValidation.ts`         | ensureVoiceChannel, ensurePlayerReady |
| **트랙 추가**       | `music/trackAdder.ts`               | addTrackToQueue, getEmbedMeta         |
| **대기열 조작**     | `music/queueOperations.ts`          | destroyQueueSafely, createProgressBar |
| **플레이어 이벤트** | `music/lavalinkEvents.ts`           | 플레이어/노드 이벤트 핸들러           |
| **버튼 인터랙션**   | `music/buttons/`                    | controlsButton, quickAddButton        |
| **Permissions**     | `discord/permissions/`              | checkPermissions, formatPermissions   |
| **Safe Reply**      | `discord/interactions/safeReply.ts` | 지연/응답 상태 안전한 reply           |
| **Embed 생성**      | `discord/embeds.ts`                 | createErrorEmbed                      |
| **Client 가져오기** | `discord/client.ts`                 | getClient() 헬퍼                      |
| **Time Format**     | `formatting/format.ts`              | Duration/Date 포맷팅                  |
| **Logger**          | `logger.ts`                         | Logger 클래스                         |

## CONVENTIONS

- **Direct imports**: Import from source modules, not barrel files
  - `@/utils/music/playerValidation` not `@/utils/music/playerUtils`
  - `@/utils/discord/embeds` not `@/utils/discord`
- **Pure Functions**: Prefer stateless utility functions
- **Localization**: Use `locale` helpers for user-facing strings
- **Error logging**: Always use `new Error(message)` for `logger.error()`, never string interpolation
