# src/shared/ — Cross-cutting Utilities

Reusable, domain-agnostic utilities. Anything used by more than one feature, command, event, or manager lives here.

## Layout

```
shared/
├── discord/           Discord.js helpers (embeds, permissions, interactions, colors, constants, client access)
├── formatting/        Message formatting utilities
├── autocomplete/      Autocomplete suggestion helpers (e.g. Google Suggest)
├── errors.ts          toError() — uniform conversion of unknown to Error
├── config.ts          Environment variable loading and validation
└── logger.ts          Project logger
```

## Boundaries

- `shared/*` MUST NOT import from `src/features/`, `src/commands/`, `src/events/`, or `src/managers/`. It is a leaf layer.
- `shared/*` MAY import from `src/types/` and `src/db/` (read-only access).

## Where to put new code

- Discord-specific helpers (embed builders, permission checks, error code handling) → `shared/discord/`
- Generic string/number formatters → `shared/formatting/`
- Generic input/suggestion helpers → `shared/autocomplete/`
- Project-wide constants and config → `shared/config.ts`, `shared/logger.ts`
- Error normalization → `shared/errors.ts`

## Conventions

- No barrel `index.ts` files. Import directly from the concrete module path.
- Helpers should be pure functions unless they explicitly need client/logger access (in which case the function accepts the dependency as a parameter).