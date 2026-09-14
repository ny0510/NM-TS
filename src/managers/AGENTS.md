# MANAGERS KNOWLEDGE BASE

## OVERVIEW

Four lifecycle managers are constructed once by the `NMClient` singleton in `src/client.ts`. `LavalinkManager`, `CooldownManager`, and `PlayerStateManager` are exposed through `client.services`; `KoreanbotsManager` is held privately.

## STRUCTURE

Flat directory. Each file exports one `class`. All managers receive a per-module `ILogger` and (where needed) the `Config` object from the constructor.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| **Add/load a command or event** | `../utils/core.ts` | Dynamically imports named `command` and `event` exports; `src/index.ts` registers them |
| **Voice join / queue CRUD** | `LavalinkManager.ts` | `createQueue` retries 3× on voice timeout; `search()` wraps `node.rest.resolve`; holds the `Shoukaku` instance and the `Map<guildId, Queue>` |
| **Persist/restore player state** | `PlayerStateManager.ts` | `saveAll()` snapshots queues to PostgreSQL; `restoreAll()` rebuilds them on boot (3s per-guild timeout); used by `clientReady` (restore) and `src/index.ts` (save on shutdown) |
| **Cooldown tracking** | `CooldownManager.ts` | Per-command `Collection<Snowflake, number>`; auto-clears via `setTimeout` |
| **Koreanbots stats** | `KoreanbotsManager.ts` | Optional (no-op if `KOREANBOTS_TOKEN` missing); self-disables on "존재하지 않는 봇" error |

## CONVENTIONS

- **Constructors take deps, never import globals**: managers receive `ILogger` and `Config` from NMClient — they do not call `@/utils/config` themselves.
- **Dynamic discovery uses `import.meta.dir`**: module paths remain native to Bun ESM.
- **Errors are normalized before logging**: use `toError(error, context)` or narrow with `instanceof Error` at the boundary.
- **`LavalinkManager.createQueue` retry budget**: `MAX_RETRIES = 3`. Each retry calls `leaveVoiceChannel` first, then waits `1000 * (attempt + 1)` ms.
- **Automatic command deploy preserves non-local commands**: `src/deploy.ts` merges existing remote entries with local commands when called by `clientReady`.
- **PlayerState persistence version gate**: `restoreAll()` filters states by `PLAYER_STATE_VERSION` — bump the constant in `src/types/playerState.ts` when the persisted shape changes.
- **KoreanbotsManager holds `client` directly**: it is the only manager that stores an `NMClient` reference (parameter property). The other managers hold the base `Client` and only need `NMClient` access inside specific methods.

## ANTI-PATTERNS (THIS DIRECTORY)

- **Do NOT remove `preserveRemoteCommands` from the `clientReady` deployment**: automatic deployment must keep remote Entry Point commands.
- **Do NOT skip `registerEvents`**: `LavalinkManager.registerEvents(client)` also captures the `NMClient` reference used by `registerPlayerEvents` later. Creating a queue before this is called means player events won't attach.
- **Do NOT cast `client` to `NMClient` casually**: `PlayerStateManager` does `this.client as unknown as NMClient` in `saveAll`/`restoreQueue` because its constructor type is the base `Client`. This is intentional but fragile — prefer widening the constructor type if you touch it.
- **Do NOT remove the per-guild restore timeout** (`RESTORE_TIMEOUT_MS = 3_000`): a single bad guild must not block boot.
