# NM-TS Agent Guide

## OVERVIEW

Discord.js + Lavalink music bot ("NM", v2.10.6). Bun runtime, TypeScript strict, ESM, Drizzle ORM + PostgreSQL, Shoukaku audio. ~5.4k lines of TS across 51 files (only `src/commands/chart.ts` exceeds 300 lines); max directory depth 6. `data/postgres/` is a committed live PG cluster (~1000 files) — treat as data, not source. No test suite exists.

## Runtime and entrypoints

- Bun is the runtime. `package.json` runs the app directly from `src/index.ts`; there is no Node wrapper.
- Real bootstrap flow: `src/index.ts` → `src/client/Client.ts` → `clientReady` / `interactionCreate` events.
- `src/index.ts` handles graceful shutdown, saves player state, notifies active text channels, destroys queues, then exits.
- Required env vars are enforced at import time in `src/utils/config.ts`. Missing `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `EMBED_COLOR_NORMAL`, `EMBED_COLOR_ERROR`, or `LOG_PREFIX` aborts startup immediately.

## Commands you can trust

- Dev: `bun run dev` → `NODE_ENV=development bun --watch --install=auto --no-clear-screen src/index.ts`
- Start: `bun run start` → `NODE_ENV=production bun src/index.ts`
- Lint: `bun run lint`
- Typecheck is not a package script; run `bunx tsc --noEmit` directly.
- `bun test` is a Bun capability, not a repo script. No checked-in `tests/` or `*.test.ts` files were found in this repo snapshot, so do not assume a test suite exists.

## Architecture map

- `src/client/Client.ts` is the wiring hub. It constructs `CommandManager`, `EventManager`, `LavalinkManager`, `CooldownManager`, `PlayerStateManager`, and `KoreanbotsManager`.
- `src/managers/CommandManager.ts` and `src/managers/EventManager.ts` dynamically load only `.ts` files from `src/commands` and `src/events`. Keep new commands/events in those folders as source `.ts` files.
- `src/events/interactionCreate.ts` is the main command path: duplicate-interaction guard, cooldown check, permission check, then `command.execute(...)`.
- `src/events/clientReady.ts` registers Lavalink events, restores persisted player state, deploys slash commands, then starts presence updates.
- `src/managers/CommandManager.ts` merges existing remote commands with local ones during deployment so non-local commands are preserved.
- `src/deploy-commands.ts` is the manual slash-command entrypoint. Usage is `bun src/deploy-commands.ts [delete] (--global | --guild)`.

## Repo-specific conventions worth keeping

- TypeScript is strict, `noUncheckedIndexedAccess` is on, `verbatimModuleSyntax` forces `import type`, module resolution is `bundler`, and `@/*` maps to `./src/*`. `noUnusedLocals`/`noUnusedParameters` are OFF.
- Prettier disables bracket spacing and sorts imports with `@trivago/prettier-plugin-sort-imports` (printWidth 350, trailingComma all, arrowParens avoid, bracketSameLine); ESLint enforces single quotes, semicolons, 2-space indent, Stroustrup braces, comma-dangle always-multiline, `no-inline-comments` error, and `no-console` OFF.
- User-facing text is Korean throughout the command/event flow.
- Nested instruction files: `src/commands/AGENTS.md`, `src/utils/AGENTS.md`, `src/managers/AGENTS.md`, and `src/events/AGENTS.md` carry area-specific rules — consult them before editing those directories.

## Discord / music gotchas

- `NMClient` only requests `Guilds` and `GuildVoiceStates` intents in code. `clientReady` separately warns if `GuildMembers` is missing, so member-dependent behavior should be treated carefully.
- Interaction responses are funneled through `safeReply` in `src/utils/discord/interactions/safeReply.ts`; prefer that helper over ad hoc reply-state branching.
- Music/runtime work usually crosses `src/managers/LavalinkManager.ts`, `src/managers/PlayerStateManager.ts`, and `src/utils/music/*`, not just command files.
- Player state is persisted across restarts; changes to queue/player lifecycle should consider both startup restore and shutdown save paths.

## Release workflow

- The only checked-in GitHub Actions workflow is `.github/workflows/docker-build.yml`.
- Releases are tag-driven: pushing `v*.*.*` builds and pushes GHCR images tagged as both `latest` and the version.
- The workflow expects `GHCR_TOKEN`; there is no general CI file here for lint/test/typecheck enforcement.
