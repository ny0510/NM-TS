# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
NM-TS is a Discord music bot built with TypeScript and Bun runtime. It uses Discord.js for Discord integration and Magmastream (Lavalink) for music streaming functionality.

## Development Commands
- `bun run dev` - Start development server with hot reload and auto-install
- `bun run start` - Start production server
- `bun run lint` - Run ESLint for code linting
- `bun src/deploy-commands.ts` - Deploy Discord slash commands

## Architecture
The codebase follows a modular architecture with clear separation of concerns:

### Core Components
- **Client (`src/client/Client.ts`)** - Main NMClient class extending Discord.js Client, orchestrates all services
- **Managers (`src/managers/`)** - Service managers for different bot functionalities:
  - `CommandManager` - Handles slash command loading and deployment
  - `EventManager` - Manages Discord event handlers
  - `LavalinkManager` - Manages Magmastream/Lavalink music functionality
  - `CooldownManager` - Handles command cooldown logic

### Commands & Events
- **Commands (`src/commands/`)** - Individual slash command implementations (play, pause, skip, etc.)
- **Events (`src/events/`)** - Discord event handlers (ready, interactions, voice state changes)

### Utilities
- **Music Utils (`src/utils/music/`)** - Music-related utilities, player management, and autoplay
- **Discord Utils (`src/utils/discord/`)** - Discord-specific utilities like safe replies and permissions
- **Formatting (`src/utils/formatting/`)** - Message and embed formatting utilities

### Configuration
- Environment variables are loaded through `src/utils/config.ts`
- Uses strict TypeScript configuration with path aliases (`@/*` maps to `./src/*`)
- ESLint enforces specific code style (single quotes, no trailing spaces, strict formatting)
- Prettier configured with import sorting and custom formatting rules

## Key Technologies
- **Runtime:** Bun (not Node.js)
- **Discord:** Discord.js v14 with Guild and GuildVoiceStates intents
- **Music:** Magmastream library for Lavalink integration
- **Logging:** Custom logger with optional Discord webhook integration
- **Language:** TypeScript with strict configuration

## Development Notes
- The bot is designed for Korean users (Korean comments and messages in codebase)
- Uses custom emoji progress bars for music playback display
- Implements graceful shutdown handling for SIGINT/SIGTERM
- All commands are slash commands, no prefix commands
- Voice state management is handled through raw Discord events