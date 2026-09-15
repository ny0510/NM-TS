# NM-TS Agent Guide

## OVERVIEW

Discord.js + Lavalink music bot ("NM", v2.12.0). Bun runtime, strict TypeScript, ESM, Drizzle ORM + PostgreSQL, and Shoukaku audio. The bootstrap and module conventions are based on `caru-ini/discord-bot-template`. `data/postgres/` is a live PostgreSQL cluster — treat it as data, not source.

## Runtime and entrypoints

- Bun is the runtime. `package.json` runs the app directly from `src/index.ts`; there is no Node wrapper.
- Real bootstrap flow: `src/index.ts` → `src/client.ts` singleton → `src/utils/core.ts` module discovery → Discord login → `clientReady` / `interactionCreate` events.
- `src/utils/error-handler.ts` handles graceful shutdown, saves player state, notifies active text channels, destroys queues, then exits.
- Required env vars are parsed at import time by Zod through `src/env.ts`. Invalid or missing required values abort startup immediately.

## Commands you can trust

- Dev: `bun run dev`
- Start: `bun run start`
- Format and lint check: `bun run check`
- Typecheck: `bun run typecheck`
- Tests: `bun test`

## Architecture map

- `src/client.ts` is the wiring hub and exports the singleton `client`. It constructs `LavalinkManager`, `CooldownManager`, `PlayerStateManager`, and `KoreanbotsManager`.
- `src/utils/core.ts` dynamically loads named `command` and `event` exports. Keep new commands/events in their source folders as `.ts` files.
- `src/events/interactionCreate.ts` is the main command path: duplicate-interaction guard, cooldown check, permission check, then `command.execute(...)`.
- `src/events/clientReady.ts` registers Lavalink events, restores persisted player state, deploys slash commands, then starts presence updates.
- `src/deploy.ts` preserves non-local remote commands during automatic startup deployment. Manual deployment remains a direct synchronization. Usage is `bun run deploy-commands [delete] (--global | --guild)`.

## Repo-specific conventions worth keeping

- TypeScript is strict, `noUncheckedIndexedAccess` is on, `verbatimModuleSyntax` forces `import type`, module resolution is `bundler`, and `@/*` maps to `./src/*`. `noUnusedLocals`/`noUnusedParameters` are OFF.
- Biome owns formatting and linting. It uses single quotes, no bracket spacing, 2-space indentation, trailing commas, and a 320-column limit.
- User-facing text is Korean throughout the command/event flow.
- Nested instruction files in `src/commands`, `src/features`, `src/managers`, `src/events`, and `src/shared` carry area-specific rules — consult them before editing those directories.

## Discord / music gotchas

- `NMClient` only requests `Guilds` and `GuildVoiceStates` intents in code. `clientReady` separately warns if `GuildMembers` is missing, so member-dependent behavior should be treated carefully.
- Interaction responses are funneled through `safeReply` in `src/shared/discord/interactions/safeReply.ts`; prefer that helper over ad hoc reply-state branching.
- Music/runtime work usually crosses `src/managers/LavalinkManager.ts`, `src/managers/PlayerStateManager.ts`, and `src/features/music/*`, not just command files.
- Player state is persisted across restarts; changes to queue/player lifecycle should consider both startup restore and shutdown save paths.

## Release workflow

- The checked-in GitHub Actions workflow is `.github/workflows/docker-build.yml`, which remains dedicated to tagged GHCR releases.
- Releases are tag-driven: pushing `v*.*.*` builds and pushes GHCR images tagged as both `latest` and the version.
- The workflow expects `GHCR_TOKEN`; there is no general CI file here for lint/test/typecheck enforcement.

## Agent Behavior Directives

- **Ask, don't assume**: 모호하거나 조건이 확실하지 않으면 스스로 판단하지 말고 사용자에게 질문한다.
