---
name: create-discord-event
description: Create or update an NM Discord event under src/events using the Bun, TypeScript, and discord.js architecture.
---

# Create Discord Event

Create one event module that exports `event` and follows the dynamic loader contract.

## Workflow

1. Read `AGENTS.md` and `src/events/AGENTS.md`.
2. Confirm the Discord event, required gateway intents, one-time behavior, and side effects.
3. Use `src/events/<eventName>.ts`; place supporting logic in a matching subdirectory when necessary.
4. Export `event` exactly using `satisfies Event<'eventName'>` from `@/types/client`.
5. Keep risky startup steps isolated so one failure does not prevent unrelated initialization.
6. Run `bun run check`, `bun run typecheck`, and `bun test`.

## Event Template

```typescript
import {Events, type VoiceState} from 'discord.js';

import type {Event} from '@/types/client';

export const event = {
  name: Events.VoiceStateUpdate,
  async execute(_oldState: VoiceState, _newState: VoiceState): Promise<void> {},
} satisfies Event<'voiceStateUpdate'>;
```

## Constraints

- Use `@/` aliases for internal imports.
- Do not use default exports, non-null assertions, `any`, or type-suppression comments.
- Add gateway intents in `src/client.ts` when the event requires them.
- Keep `clientReady` idempotent and preserve player-state restoration and shutdown contracts.
