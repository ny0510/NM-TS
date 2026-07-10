# EVENTS KNOWLEDGE BASE

## OVERVIEW

Six Discord.js event handlers dynamically loaded by `EventManager`. Each file `export default { name, once?, execute } satisfies Event<...>`.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| **Command/button/autocomplete dispatch** | `interactionCreate.ts` | Main entry; duplicate guard → cooldown → permission check → `command.execute()`. Buttons routed to `handleQuickAddButton` / `handlePlayerControlsButtons`. |
| **Boot sequence (once)** | `clientReady.ts` | Registers Lavalink events, restores player state, deploys commands, starts 10s presence interval. Exports `clearPresenceInterval()` called by `NMClient.destroy()`. |
| **Empty channel / bot-kick handling** | `voiceStateUpdate.ts` (44 LOC) + `voiceStateUpdate/` directory | Pauses on empty channel, auto-destroys after 10 min, destroys on bot kick/timeout. Logic split across `activityManager.ts`, `botHandler.ts`, `notifications.ts`. Module-level `activePlayers` timeout map in `voiceStateUpdate.ts`. |
| **New-guild onboarding** | `guildCreate.ts` | Checks permissions, DMs owner with invite link if missing. |
| **Guild removal** | `guildDelete.ts` | Logs the leave only. |
| **Bot timeout detection** | `guildMemberUpdate.ts` | Detects `communicationDisabledUntil` set on the bot → destroys queue. |

## CONVENTIONS

- **Type**: `export default {...} satisfies Event<'eventName'>` (NOT `as Event`).
- **NMClient access**: event files cast `client as NMClient` (or `oldState.client as NMClient`); `interactionCreate.ts` instead uses `getClient(interaction)` from `@/utils/discord/client`. Two patterns coexist — preserve whichever the surrounding file uses.
- **Reply**: route all replies through `safeReply` from `@/utils/discord/interactions/safeReply`. (`interactionCreate.ts` is the canonical example.)
- **Module-level state only when necessary**: `clientReady.ts` keeps `presenceToggle`/`presenceInterval`; `voiceStateUpdate.ts` keeps the `activePlayers` timeout map. The presence interval is cleared via the exported `clearPresenceInterval()`, called from `NMClient.destroy()`.
- **Error logging**: `client.logger.error(toError(error, context))` (uses `@/utils/errors`).

## ANTI-PATTERNS (THIS DIRECTORY)

- **Do NOT bypass `safeReply`**: any new reply in these files should go through `safeReply`, never raw `interaction.reply/editReply`.
- **Do NOT remove the duplicate-interaction guard** (`isInteractionProcessed`): it suppresses duplicate dispatches from Discord retries.
- **Do NOT block `clientReady`**: the Lavalink event registration, player-state restore, command deploy, and presence interval must all stay inside the single `execute`. Wrap risky sub-steps in their own try/catch so one failure doesn't abort the rest (the restore step already does this).
- **`clientReady` is `once: true`**: it must be idempotent. Re-running it (e.g. after a reconnect) is not supported.
