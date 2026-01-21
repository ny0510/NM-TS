# UTILS KNOWLEDGE BASE

## OVERVIEW

Shared helper functions and configurations for Music, Discord interactions, and text formatting.

## STRUCTURE

```
src/utils/
├── music/        # Lavalink helpers, player utils
├── discord/      # Permissions, interactions, mentions
├── formatting/   # Text formatting, regex patterns
└── autocomplete/ # Google suggest integration
```

## WHERE TO LOOK

| Task            | Location                            | Notes                          |
| --------------- | ----------------------------------- | ------------------------------ |
| **Permissions** | `discord/permissions/`              | Check user/bot perms           |
| **Safe Reply**  | `discord/interactions/safeReply.ts` | Handle deferred/replied states |
| **Time Format** | `formatting/format.ts`              | Duration/Date formatting       |
| **Track Utils** | `music/playerUtils.ts`              | Common player operations       |

## CONVENTIONS

- **Pure Functions**: Prefer stateless utility functions.
- **Localization**: Use `locale` helpers for user-facing strings.
