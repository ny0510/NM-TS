# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-22
**Context:** NM-TS Discord Music Bot

## OVERVIEW

Discord music bot built with **TypeScript** and **Bun**. Uses **Discord.js** (v14) for interactions and **Magmastream** (Lavalink) for audio streaming. Designed for Korean users with strict type safety.

## STRUCTURE

```
.
├── src/
│   ├── client/       # Main NMClient extended class
│   ├── commands/     # Slash command implementations (19 files)
│   ├── events/       # Discord event handlers
│   ├── managers/     # Core logic (Command, Event, Lavalink, Cooldown)
│   ├── services/     # External services (StatsService)
│   └── utils/        # Helpers (Music, Discord, Formatting, Config)
├── tests/            # Bun-native tests
└── lavalink/         # Lavalink configuration and plugins
```

## WHERE TO LOOK

| Task            | Location                          | Notes                                                |
| --------------- | --------------------------------- | ---------------------------------------------------- |
| **Commands**    | `src/commands/*.ts`               | Slash command definitions (must implement `Command`) |
| **Music Logic** | `src/managers/LavalinkManager.ts` | Magmastream wrapper & audio handling                 |
| **Client**      | `src/client/Client.ts`            | Main bot entry point & setup                         |
| **Config**      | `src/utils/config.ts`             | Env var loading                                      |
| **Permissions** | `src/utils/discord/permissions`   | Permission checking & localization                   |
| **Tests**       | `tests/**/*.test.ts`              | Unit tests using `bun test`                          |

## CONVENTIONS

- **Runtime**: Bun ONLY (no Node.js). Use `Bun.file`, `Bun.serve` where applicable.
- **Imports**: Path aliases `@/*` map to `./src/*`.
- **Strictness**: `"strict": true`, `noUncheckedIndexedAccess` enabled.
- **Style**: Single quotes, no trailing spaces.
- **Async**: Heavy use of async/await for Discord/Lavalink ops.

## ANTI-PATTERNS (THIS PROJECT)

- **No Prefix Commands**: Only Slash commands allowed.
- **No `any`**: Strict TypeScript enforcement.
- **No Node.js APIs**: Avoid `fs`, `path` if Bun alternatives exist.
- **No Global State**: Use Managers or Client instance.

## COMMANDS

```bash
bun run dev         # Hot-reload dev server
bun run start       # Production start
bun run lint        # ESLint
bun test            # Run unit tests
bun src/deploy-commands.ts # Sync slash commands
```

## NOTES

- **Voice States**: Handled via raw events in `src/events/voiceStateUpdate.ts`.
- **Lavalink**: Requires running Lavalink server (config in `lavalink/application.yml`).
- **Korean Localization**: Messages and comments are in Korean.
