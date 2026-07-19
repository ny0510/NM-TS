# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

NM is a Discord.js + Lavalink music bot (Bun runtime, TypeScript strict, ESM, Drizzle ORM + PostgreSQL, Shoukaku for audio). User-facing text is Korean throughout. `data/postgres/` is a committed live PG cluster (~1000 files) — treat as data, not source. No test suite exists in this repo.

There is a nested `AGENTS.md` at the repo root and in `src/commands/`, `src/managers/`, `src/events/` with area-specific conventions and anti-patterns — read the relevant one before editing those directories. Note: the root `AGENTS.md` still references a pre-refactor `src/utils/` layout in places; the current directory layout is `src/features/` and `src/shared/` (see Architecture below) — trust this file and the actual filesystem over stale path references in `AGENTS.md`.

## Commands

- Dev: `bun run dev` → runs `src/index.ts` with `bun --watch --install=auto`, `NODE_ENV=development`
- Start: `bun run start` → `NODE_ENV=production bun src/index.ts`
- Lint: `bun run lint` (ESLint over `.ts` files)
- Typecheck: not a package script — run `bunx tsc --noEmit` directly
- DB migrations: `bun run db:generate` (drizzle-kit generate), `bun run db:migrate` / `db:migrate:once` (drizzle-kit migrate)
- Deploy slash commands manually: `bun src/deploy-commands.ts [delete] (--global | --guild)`
- No `bun test` script or `*.test.ts` files exist — do not assume a test suite.

Required env vars (checked at import time in `src/shared/config.ts`, missing any aborts startup): `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `EMBED_COLOR_NORMAL`, `EMBED_COLOR_ERROR`, `LOG_PREFIX`. Lavalink/Koreanbots/progress-bar-emoji vars have defaults.

`docker-compose.yml` runs the full stack: `postgres`, `lavalink`, `ejs-api` (YouTube cipher signature service Lavalink depends on), a one-shot `migrate` service, and the `nm` app container — in that dependency order.

## Architecture

**Bootstrap flow**: `src/index.ts` → constructs `NMClient` (`src/client/Client.ts`) → fires `clientReady`/`interactionCreate` events. `src/index.ts` also owns graceful shutdown (`SIGINT`/`SIGTERM`): saves player state, notifies active text channels, destroys queues, then exits.

**`NMClient`** (`src/client/Client.ts`) is the wiring hub. It builds five services exposed via `client.services` — `CommandManager`, `EventManager`, `LavalinkManager`, `CooldownManager`, `PlayerStateManager` — plus a private `KoreanbotsManager`. All managers live flat in `src/managers/` (with `lavalink/` and `playerState/` subfolders for internals); see `src/managers/AGENTS.md` for per-manager responsibilities and gotchas (retry budgets, restore timeouts, the non-merging `deploy-commands.ts` vs. the merging `CommandManager.deployCommands`).

**Command/event dispatch**: `CommandManager`/`EventManager` dynamically `import()` every `.ts` file in `src/commands/` / `src/events/` at startup (via `__dirname` + `readdir`, a Bun-specific pattern). `src/events/interactionCreate.ts` is the main interaction router: duplicate-interaction guard → cooldown check → permission check → `command.execute(...)`; buttons/select-menus for music controls, favorites, and quick-add are routed here too, not through the command dispatch path.

**Directory layout** (post-refactor, current):
- `src/commands/` — one Discord slash command per file, `export default {...} satisfies Command` (see `src/commands/AGENTS.md`)
- `src/events/` — one Discord.js event handler per file, `export default {...} satisfies Event<'name'>` (see `src/events/AGENTS.md`); `voiceStateUpdate.ts` has a `voiceStateUpdate/` subfolder for split-out logic
- `src/managers/` — singleton lifecycle managers constructed once by `NMClient`
- `src/features/` — domain logic grouped by feature: `music/` (queue, track resolution/adding, buttons, interaction handlers), `favorites/`, `chart/`, `analytics/`
- `src/shared/` — cross-cutting utilities: `config.ts`, `errors.ts`, `logger.ts`, `discord/` (client helpers, embeds, permissions, `safeReply`/`safeAutocomplete`), `formatting/`, `autocomplete/`
- `src/db/` — Drizzle schema (`schema.ts`) and query helpers; migrations in `src/db/migrations/`
- `src/types/` — shared interfaces (`Command`, `Event<K>`, `Config`, `ClientServices`, player state types)

**Command/event contracts** (`src/types/client.ts`): `Command` = `{ data: SlashCommandBuilder|..., permissions?, cooldown?, execute(interaction), autocomplete?(interaction) }`. `Event<K>` = `{ name: K, once?, execute(...args: ClientEvents[K]) }`. Always use `satisfies`, never `as`.

**Reply pattern**: all interaction replies should route through `safeReply` (`src/shared/discord/interactions/safeReply.ts`), which handles the replied/deferred state branching. A couple of legacy commands (`broadcast.ts`, `ping.ts`) still call raw `interaction.reply`/`editReply` — don't extend that pattern to new code.

**Player state persistence**: `PlayerStateManager` snapshots/restores queues to Postgres (`player_states` table, versioned via `PLAYER_STATE_VERSION` in `src/types/playerState.ts`). Restore happens in `clientReady` on boot (per-guild timeout so one bad guild doesn't block startup); save happens in `src/index.ts` on shutdown. Any change to queue/player lifecycle needs to consider both paths.

**Command deploy**: `CommandManager.deployCommands` (used at runtime in `clientReady`) merges local commands with existing remote ones, preserving remote-only entries like Entry Point commands. The standalone `src/deploy-commands.ts` script does a straight PUT with no merge — running it will wipe non-local remote commands.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess` on, `verbatimModuleSyntax` forces `import type`, `moduleResolution: bundler`, `@/*` → `./src/*`. `noUnusedLocals`/`noUnusedParameters` are OFF.
- Prettier: no bracket spacing, imports sorted via `@trivago/prettier-plugin-sort-imports`, `printWidth` 350, trailing commas everywhere, `arrowParens: avoid`, `bracketSameLine: true`.
- ESLint: single quotes, semicolons required, 2-space indent, Stroustrup brace style, `comma-dangle: always-multiline`, `no-inline-comments` is an error, `no-console` is OFF.
- Errors: wrap with `toError(error, context)` from `src/shared/errors.ts` before logging (`logger.error(toError(...))`), not raw `Error` construction or template-literal logging.
- Discord error codes: use `RESTJSONErrorCodes.X` from `discord-api-types/v10`, not magic numbers (`10008`, `10062`, `40060`).
