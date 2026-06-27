# COMMANDS KNOWLEDGE BASE

## OVERVIEW

Contains 20 Slash Command implementations for the NM music bot. All commands interact via Discord.js `ChatInputCommandInteraction`.

## STRUCTURE

Flat directory. Each file exports a single command object using `satisfies Command`.

## WHERE TO LOOK

| Task              | Location                                                            | Notes                  |
| ----------------- | ------------------------------------------------------------------- | ---------------------- |
| **Music Control** | `play.ts`, `skip.ts`, `stop.ts`, `pause.ts`, `resume.ts`, `seek.ts` | Core music playback    |
| **Queue Mgmt**    | `queue.ts`, `remove.ts`, `shuffle.ts`, `clear.ts`                   | Queue manipulation     |
| **Repeat/Auto**   | `repeat.ts`, `autoplay.ts`, `autoshuffle.ts`                        | 반복/자동재생/자동셔플 |
| **Info**          | `info.ts`, `ping.ts`, `now.ts`                                      | Bot/Track status       |
| **Config**        | `volume.ts`, `speed.ts`                                             | Player settings        |
| **Broadcast**     | `broadcast.ts`                                                      | 공지 명령어            |
| **Search**        | `search.ts`                                                         | 검색 명령어            |
| **Chart**         | `chart.ts`                                                          | 음악 차트/순위         |

## CONVENTIONS

- **Type**: Use `satisfies Command` (NOT `as Command`)
- **Import type**: `import type {Command} from '@/types/client'`
- **Export**: `export default { ... } satisfies Command`
- **Client**: Use `getClient(interaction)` (never manual cast)
- **Reply**: Use `safeReply` from `@/utils/discord/interactions/safeReply`
- **Validation**: Import directly from source modules:
  - `@/utils/music/playerValidation` (ensureVoiceChannel, ensurePlayerReady, etc.)
  - NOT from barrel file `@/utils/music/playerUtils`
- **Embeds**: Use `createErrorEmbed` from `@/utils/discord/embeds`
- **Cooldowns**: Optional `cooldown` property (seconds, managed by CooldownManager)
- **Permissions**: Optional `permissions` array (BigInt permission flags)

## ANTI-PATTERNS (THIS DIRECTORY)

- **Do NOT import from the `@/utils/music/playerUtils` barrel**: ~18 commands pull from `@/utils/music` and 4 from `@/utils/music/playerUtils`. Import from the concrete source module instead (e.g. `@/utils/music/playerValidation`, `@/utils/music/trackAdder`). The barrel exists for re-export only.
- **Do NOT bypass `safeReply`**: `broadcast.ts` and `ping.ts` call raw `interaction.reply`/`interaction.editReply`. New commands must route every reply through `safeReply`.
- **Do NOT leave dead commented code**: `chart.ts:29-37,41` contains dead commented-out blocks. Remove unused logic outright.
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
    if (!(await ensureVoiceChannel(interaction))) return;
    // Command logic
  },
} satisfies Command;
```
