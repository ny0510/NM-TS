---
name: create-discord-command
description: Create or update an NM Discord slash command under src/commands using the Bun, TypeScript, and discord.js architecture.
---

# Create Discord Command

Create one command module that exports `command` and follows the repository contract.

## Workflow

1. Read `AGENTS.md` and `src/commands/AGENTS.md`.
2. Confirm the command name, description, options or subcommands, permissions, cooldown, and public or ephemeral response behavior.
3. Use `src/commands/<name>.ts` for a command and move complex domain logic into the relevant `src/features/` module.
4. Export `command` exactly using `satisfies Command` from `@/types/client`.
5. Route interaction responses through `safeReply` from `@/shared/discord/interactions`.
6. Run `bun run check`, `bun run typecheck`, and `bun test`.
7. Deploy only when explicitly requested, using `bun run deploy-commands --guild` or `--global`.

## Command Template

```typescript
import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';

import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('command-name').setDescription('명령어 설명'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await safeReply(interaction, {
      content: '응답',
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
```

## Constraints

- Use `@/` aliases for internal imports.
- Do not use default exports, non-null assertions, `any`, or type-suppression comments.
- Keep user-facing messages in Korean.
- Preserve cooldown, permission, duplicate-interaction, and `safeReply` behavior.
