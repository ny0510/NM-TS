# src/features/ — Domain Business Logic

Per-feature directories containing the business logic for each domain. Commands and events stay at `src/commands/` and `src/events/` respectively; `features/` holds the supporting code they call.

## Layout

```
features/
├── analytics/      Play-event tracking (trackPlayEvents)
├── chart/          Chart embed + collector + stats
├── favorites/      Favorites service, components, interaction router, handlers
└── music/          Queue model, track adder, player interactions, validation guard, music-specific buttons
```

## Boundaries

- `features/*` MUST NOT import from `src/commands/`, `src/events/`, or `src/index.ts`. Features are called *by* those layers.
- `features/*` MUST NOT import from each other across domains (e.g. `features/chart/` MUST NOT import `features/music/`). If shared logic is needed, lift it to `src/shared/` or `features/music/` (only as an exception when the logic is music-specific).
- `features/music/` may import from `features/favorites/` only if a music operation explicitly references a favorite (currently none).

## Where to put new code

- New music-related command helpers → `features/music/`
- New favorites logic → `features/favorites/`
- New chart rendering or stats → `features/chart/`
- New play-event tracking → `features/analytics/`
- Generic cross-domain utilities (Discord helpers, errors, formatting) → `src/shared/`

## Conventions

- Each feature directory may contain its own `*.ts` modules and subdirectories; no barrel `index.ts` files.
- Imports across features or into `commands/`/`events/` use `@/` aliases — see root `AGENTS.md`.