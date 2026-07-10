# COMMANDS KNOWLEDGE BASE

## OVERVIEW

Contains 20 Slash Command implementations for the NM music bot. All commands interact via Discord.js `ChatInputCommandInteraction`.

## STRUCTURE

Flat directory. Each file exports a single command object using `satisfies Command`.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| **Music Control** | `play.ts`, `skip.ts`, `stop.ts`, `pause.ts`, `resume.ts`, `seek.ts` | Core music playback |
| **Queue Mgmt** | `queue.ts`, `remove.ts`, `shuffle.ts`, `clear.ts` | Queue manipulation |
| **Repeat/Auto** | `repeat.ts`, `autoplay.ts`, `autoshuffle.ts` | 반복/자동재생/자동셔플 |
| **Info** | `info.ts`, `ping.ts`, `now.ts` | Bot/Track status |
| **Config** | `volume.ts`, `speed.ts` | Player settings |
| **Broadcast** | `broadcast.ts` | 공지 명령어 |
| **Search** | `search.ts` | 검색 명령어 |
| **Chart** | `chart.ts` (collector 추출됨) | 음악 차트/순위 |

## CONVENTIONS

- **Type**: Use `satisfies Command` (NOT `as Command`)
- **Import type**: `import type {Command} from '@/types/client'`
- **Export**: `export default { ... } satisfies Command`
- **Client**: Use `getClient(interaction)` (never manual cast)
- **Reply**: Use `safeReply` from `@/utils/discord/interactions/safeReply`
- **Validation**: Import `validateMusicCommand` and `ensure*` helpers from `@/utils/music/commandGuard`
- **Embeds**: Use `createErrorEmbed` from `@/utils/discord/embeds`
- **Embed colors**: Use `getColors(client.config)` from `@/utils/discord/embedColors`
- **Error logging**: Use `toError(error, context)` from `@/utils/errors`
- **Cooldowns**: Optional `cooldown` property (seconds, managed by CooldownManager)
- **Permissions**: Optional `permissions` array (BigInt permission flags)
- **Cross-domain imports**: Import from `@/music/trackAdder` (not the old `@/utils/music/trackAdder`); from `@/structures/queue/Queue`; from `@/analytics/trackPlayEvents`; etc.

## ANTI-PATTERNS (THIS DIRECTORY)

- **Do NOT import from the `@/utils/music/index` or `@/utils/music/playerUtils` barrels**: Both were deleted in R16. Import directly from `@/utils/music/commandGuard`, `@/utils/music/queueOperations`, `@/utils/music/trackMeta`, etc.
- **Do NOT bypass `safeReply`**: `broadcast.ts` and `ping.ts` still call raw `interaction.reply`/`interaction.editReply`. New commands must route every reply through `safeReply`.
- **Do NOT use Discord error code magic numbers** (e.g. `10008`, `10062`, `40060`): Use `RESTJSONErrorCodes.UnknownMessage`, etc. from `discord-api-types/v10`.
- **Do NOT leave dead commented code**: remove unused logic outright when refactoring.
- **Do NOT rely on `noUnusedParameters` being off to stub params**: prefer `_`-prefix or genuinely omit.

## Example

```typescript
import type {Command} from '@/types/client';

export default {
  data: new SlashCommandBuilder().setName('example').setDescription('설명'),
  permissions: [PermissionsBitField.Flags.Connect],
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = getClient(interaction);
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    // Command logic
  },
} satisfies Command;
```