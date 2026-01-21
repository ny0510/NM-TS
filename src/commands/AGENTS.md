# COMMANDS KNOWLEDGE BASE

## OVERVIEW

Contains 19 Slash Command implementations for the NM music bot. All commands interact via Discord.js `ChatInputCommandInteraction`.

## STRUCTURE

Flat directory. Each file exports a single command object.

## WHERE TO LOOK

| Task              | Location                              | Notes               |
| ----------------- | ------------------------------------- | ------------------- |
| **Music Control** | `play.ts`, `skip.ts`, `stop.ts`       | Core music playback |
| **Queue Mgmt**    | `queue.ts`, `remove.ts`, `shuffle.ts` | Queue manipulation  |
| **Info**          | `info.ts`, `ping.ts`, `now.ts`        | Bot/Track status    |
| **Config**        | `volume.ts`, `speed.ts`               | Player settings     |

## CONVENTIONS

- **Interface**: MUST implement `Command` interface (from `src/managers/CommandManager`).
- **Export**: `export default const command: Command = { ... }`
- **Interaction**: Use `safeReply` or `interaction.reply`.
- **Validation**: Check for voice channel/player existence before executing logic.
