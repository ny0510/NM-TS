# NM-TS AGENT KNOWLEDGE BASE

**Generated:** 2026-02-23
**Context:** Discord Music Bot (TypeScript + Bun + Discord.js v14 + Shoukaku)

---

## PROJECT OVERVIEW

Discord music bot with **strict TypeScript** type safety, Korean localization, and Lavalink audio streaming. Built exclusively for **Bun runtime** (no Node.js compatibility).

**Stack:** TypeScript + Bun + Discord.js v14 + Shoukaku (Lavalink wrapper)

---

## COMMANDS

```bash
# Development & Production
bun run dev                    # Hot-reload with auto-install
bun run start       # Production start
# Code Quality
bun run lint                   # Run ESLint

# Testing
bun test                       # Run all tests
bun test tests/utils/playerUtils.test.ts  # Run single test file
bun test --watch               # Watch mode

# Deployment
bun src/deploy-commands.ts     # Sync slash commands to Discord

# Build (bundler)
bun build src/index.ts --outdir dist --target bun
```

---

## CODE STYLE GUIDELINES

### TypeScript Strictness

- **`strict: true`** + `noUncheckedIndexedAccess: true` (tsconfig.json)
- **NEVER use `any`** — Use `unknown` and type narrowing instead
- **NEVER suppress errors** with `@ts-ignore`, `@ts-expect-error`, or `as any`
- **Array access**: Always check bounds (`array[index]` may be `undefined`)
- **Optional chaining**: Use `?.` for nullable properties

### Imports & Modules

- **Path aliases**: Use `@/*` for all internal imports (maps to `./src/*`)
- **Import order**: Auto-sorted by Prettier plugin (local imports separated)
- **Type imports**: Use `import type` for type-only imports
- **Extensions**: `.ts` extensions allowed but not required (bundler mode)

**Example:**

```typescript
import {ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {LoadType, type Track} from 'shoukaku';

import type {NMClient} from '@/client/Client';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
```

### Formatting (ESLint + Prettier)

- **Quotes**: Single quotes (`'hello'`) — enforced by ESLint
- **Semicolons**: Always required — enforced by ESLint
- **Indentation**: 2 spaces (no tabs)
- **Line length**: 350 chars (Prettier config)
- **Trailing commas**: Always in multiline structures
- **Brace style**: Stroustrup (else/catch on new line)
- **Object spacing**: No spaces (`{key: value}` not `{ key: value }`)
- **Arrow functions**: No parens for single param (`x => x * 2`)

**Example:**

```typescript
// ✅ Correct
const data = {name: 'test', value: 42};
const fn = async (id: string) => {
  if (!id) {
    throw new Error('Missing ID');
  }
  return id;
};

// ❌ Wrong
const data = { name: "test", value: 42 }  // Double quotes, spaces in braces, no semicolon
const fn = async id => { return id }       // Missing type annotation
```

### Naming Conventions

- **Files**: camelCase (`playerUtils.ts`, `safeReply.ts`)
- **Types/Interfaces**: PascalCase (`NMClient`, `Command`)
- **Functions/Variables**: camelCase (`createPlayer`, `addFirst`)
- **Constants**: SCREAMING_SNAKE_CASE (`EMBED_COLOR_ERROR`)
- **Private helpers**: No prefix (rely on module scope)

### Error Handling

- **Never empty catch blocks** — Always log or handle errors
- **Use Error objects**: `new Error(message)` not plain strings
- **Type errors**: Check with `error instanceof Error`
- **DiscordAPIError**: Catch specific error codes (e.g., `10062` for expired interactions)

**Example:**

```typescript
// ✅ Good
try {
  await interaction.respond(choices);
} catch (error) {
  if (error instanceof DiscordAPIError && error.code === 10062) {
    client.logger.debug('Autocomplete interaction expired');
    return;
  }
  client.logger.error(new Error(`Failed: ${error instanceof Error ? error.message : String(error)}`));
}

// ❌ Bad
try {
  await interaction.respond(choices);
} catch (e) {}  // Empty catch
```

### Async/Await

- **Prefer async/await** over `.then()/.catch()`
- **Always await** Discord API calls and Lavalink operations
- **No floating promises** — Always await or explicitly ignore

### Comments & Localization

- **Comments**: Korean (matches user-facing messages)
- **User messages**: Korean (bot serves Korean users)
- **Code/Types**: English acceptable for technical terms

---

## PROJECT STRUCTURE

```
src/
├── client/       # NMClient (extends Discord.js Client)
├── commands/     # Slash commands (19 files, implement Command interface)
├── events/       # Discord event handlers (clientReady, interactionCreate, etc.)
├── managers/     # Core logic (CommandManager, EventManager, LavalinkManager, CooldownManager)
├── services/     # External services (StatsService for koreanbots.dev)
└── utils/
    ├── music/        # Player helpers, buttons, Lavalink events
    ├── discord/      # Embeds, permissions, interactions, client utils
    ├── formatting/   # Text formatting (time, hyperlinks, truncation)
    ├── autocomplete/ # Google Suggest integration
    └── config.ts     # Environment variable loading

tests/            # Bun-native tests (bun:test)
lavalink/         # Lavalink server config & plugins
```

---

## WHERE TO LOOK

| Task                     | Location                         | Key Files                                       |
| ------------------------ | -------------------------------- | ----------------------------------------------- |
| **Add/modify commands**  | `src/commands/`                  | `play.ts`, `queue.ts`, `skip.ts`                |
| **Music player logic**   | `src/utils/music/`               | `playerUtils.ts` (helpers), `lavalinkEvents.ts` |
| **Lavalink integration** | `src/managers/`                  | `LavalinkManager.ts` (Shoukaku wrapper)         |
| **Permission checks**    | `src/utils/discord/permissions/` | `checkPermissions.ts`, `locale/permission.ts`   |
| **Embed helpers**        | `src/utils/discord/`             | `embeds.ts` (error/success embeds)              |
| **Client setup**         | `src/client/`                    | `Client.ts` (NMClient class, intents)           |
| **Event handlers**       | `src/events/`                    | `voiceStateUpdate.ts`, `clientReady.ts`         |
| **Tests**                | `tests/`                         | `utils/playerUtils.test.ts`                     |

---

## KEY PATTERNS

### Command Structure

All commands must implement the `Command` interface:

```typescript
import type {Command} from '@/client/types';

export default {
  data: new SlashCommandBuilder().setName('example').setDescription('설명'),
  permissions: [PermissionsBitField.Flags.Connect],
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = getClient(interaction);
    // Command logic
  },
} as Command;
```

### Validation Pattern

Use helper functions from `@/utils/music/playerUtils`:

```typescript
// Simple validation
if (!(await ensureVoiceChannel(interaction))) return;
if (!(await ensureSameVoiceChannel(interaction))) return;

// Combined validation
if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;
```

### Client Type Casting

Always use `getClient()` helper (never cast manually):

```typescript
// ✅ Correct
const client = getClient(interaction);

// ❌ Wrong
const client = interaction.client as NMClient;
```

### Safe Replies

Use `safeReply()` to handle deferred/replied states:

```typescript
import {safeReply} from '@/utils/discord/interactions';

await safeReply(interaction, {
  embeds: [createErrorEmbed(client, '제목', '설명')],
  flags: MessageFlags.Ephemeral,
});
```

---

## TESTING

### Test Structure (Bun-native)

```typescript
import {beforeEach, describe, expect, it, mock} from 'bun:test';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup mocks
  });

  it('should do something', async () => {
    const result = await functionUnderTest();
    expect(result).toBe(expectedValue);
  });
});
```

### Mocking

- Use `mock()` from `bun:test`
- Use `mock.module()` to mock entire modules
- Use `@ts-ignore` sparingly in tests when mocking complex types

---

## ANTI-PATTERNS (NEVER DO)

❌ **Type suppression**: `as any`, `@ts-ignore`, `@ts-expect-error`
❌ **Node.js APIs**: `fs`, `path` (use Bun equivalents like `Bun.file`)
❌ **Prefix commands**: Only slash commands allowed
❌ **Global state**: Use Managers or pass via Client instance
❌ **Empty catch blocks**: Always log errors
❌ **Manual client casting**: Use `getClient(interaction)` helper
❌ **Inline permissions**: Use `formatMissingPermissions()` helper
❌ **Direct player access without validation**: Use `ensurePlayerReady()`

---

## ENVIRONMENT

- **Runtime**: Bun only (NOT Node.js)
- **TypeScript**: 5.8.3+ with strict mode
- **Target**: ESNext (latest ECMAScript features)
- **Module resolution**: Bundler mode (verbatimModuleSyntax)

---

## NOTES FOR AGENTS

1. **Always check types** — This project has strict null checks and index access checks
2. **Voice channel validation** — Most music commands require voice channel checks
3. **Korean messages** — All user-facing messages are in Korean
4. **Lavalink dependency** — Music features require a running Lavalink server
5. **Permissions** — Commands specify required bot permissions in `permissions` array
6. **Cooldowns** — Commands can specify `cooldown` in seconds (managed by CooldownManager)
7. **Build verification** — Always run `bun build` after file changes to verify TypeScript correctness
8. **Test before commit** — Run `bun test` to ensure no regressions
