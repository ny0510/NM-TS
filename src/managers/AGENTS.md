# MANAGERS KNOWLEDGE BASE

## OVERVIEW

Six singleton lifecycle managers constructed once by `NMClient` (`src/client/Client.ts:37-45`). Five are exposed via `client.services` (`CommandManager`, `EventManager`, `LavalinkManager`, `CooldownManager`, `PlayerStateManager`); `KoreanbotsManager` is held privately on NMClient and is the only manager that takes NMClient directly as a constructor parameter.

## STRUCTURE

Flat directory. Each file exports one `class`. All managers receive a per-module `ILogger` and (where needed) the `Config` object from the constructor.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| **Add/load a command** | `CommandManager.ts` | `loadCommands()` dynamically `import()`s `src/commands/*.ts`; `deployCommands()` merges remote + local (preserves non-local Entry Point commands) |
| **Load/register an event** | `EventManager.ts` | `loadEvents()` dynamically `import()`s `src/events/*.ts`; routes to `client.on/once` |
| **Voice join / queue CRUD** | `LavalinkManager.ts` | `createQueue` retries 3× on voice timeout; `search()` wraps `node.rest.resolve`; holds the `Shoukaku` instance and the `Map<guildId, Queue>` |
| **Persist/restore player state** | `PlayerStateManager.ts` | `saveAll()` snapshots queues to PostgreSQL; `restoreAll()` rebuilds them on boot (3s per-guild timeout); used by `clientReady` (restore) and `src/index.ts` (save on shutdown) |
| **Cooldown tracking** | `CooldownManager.ts` | Per-command `Collection<Snowflake, number>`; auto-clears via `setTimeout` |
| **Koreanbots stats** | `KoreanbotsManager.ts` | Optional (no-op if `KOREANBOTS_TOKEN` missing); self-disables on "존재하지 않는 봇" error |

## CONVENTIONS

- **Constructors take deps, never import globals**: managers receive `ILogger` and `Config` from NMClient — they do not call `@/utils/config` themselves.
- **Dynamic discovery uses `__dirname`**: `CommandManager.loadCommands` and `EventManager.loadEvents` use `path.join(__dirname, '..', ...)` + `readdir(...).filter(f => f.endsWith('.ts'))`. Relies on Bun's `__dirname` polyfill — a cross-runtime hazard under Node ESM.
- **Errors logged as `new Error(message)`**: `logger.error(error instanceof Error ? error : new Error(...))`. The one exception is `EventManager.ts:44` which uses a template literal (known deviation).
- **`LavalinkManager.createQueue` retry budget**: `MAX_RETRIES = 3`. Each retry calls `leaveVoiceChannel` first, then waits `1000 * (attempt + 1)` ms.
- **Command deploy preserves non-local commands**: `mergeCommands()` keeps existing remote entries (e.g. Entry Point commands) that local code does not define. The standalone `src/deploy-commands.ts` does NOT do this and would wipe them.
- **PlayerState persistence version gate**: `restoreAll()` filters states by `PLAYER_STATE_VERSION` — bump the constant in `src/types/playerState.ts` when the persisted shape changes.
- **KoreanbotsManager holds `client` directly**: it is the only manager that stores an `NMClient` reference (parameter property). The other managers hold the base `Client` and only need `NMClient` access inside specific methods.

## ANTI-PATTERNS (THIS DIRECTORY)

- **Do NOT use `src/deploy-commands.ts` semantics in `CommandManager`**: the manual script does a straight PUT without merge; the auto-deploy path must always keep the merge step.
- **Do NOT skip `registerEvents`**: `LavalinkManager.registerEvents(client)` also captures the `NMClient` reference used by `registerPlayerEvents` later. Creating a queue before this is called means player events won't attach.
- **Do NOT cast `client` to `NMClient` casually**: `PlayerStateManager` does `this.client as unknown as NMClient` in `saveAll`/`restoreQueue` because its constructor type is the base `Client`. This is intentional but fragile — prefer widening the constructor type if you touch it.
- **Do NOT remove the per-guild restore timeout** (`RESTORE_TIMEOUT_MS = 3_000`): a single bad guild must not block boot.
