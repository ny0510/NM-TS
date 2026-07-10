import {type AutocompleteInteraction, type ChatInputCommandInteraction, type ClientEvents, type HexColorString, PermissionsBitField, SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, type SlashCommandSubcommandsOnlyBuilder} from 'discord.js';

import type {CommandManager} from '@/managers/CommandManager';
import type {CooldownManager} from '@/managers/CooldownManager';
import type {EventManager} from '@/managers/EventManager';
import type {LavalinkManager} from '@/managers/LavalinkManager';
import type {PlayerStateManager} from '@/managers/PlayerStateManager';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  permissions?: PermissionsBitField[] | bigint[];
  cooldown?: number;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): Promise<void> | void;
}

export interface DiscordConfig {
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_GUILD_ID: string;
  DISCORD_LOG_WEBHOOK_URL: string;
}

export interface LavalinkConfig {
  LAVALINK_IDENTIFIER: string;
  LAVALINK_HOST: string;
  LAVALINK_PORT: number;
  LAVALINK_PASSWORD: string;
  LAVALINK_SECURE: boolean;
  LAVALINK_SEARCH_PREFIX: string;
}

export interface EmbedConfig {
  EMBED_COLOR_NORMAL: HexColorString;
  EMBED_COLOR_ERROR: HexColorString;
}

export interface AppConfig {
  DEFAULT_VOLUME: number;
  LOG_PREFIX: string;
  IS_DEV_MODE: boolean;
}

export interface ProgressBarConfig {
  PROGRESS_CIRCLE_START: string;
  PROGRESS_CIRCLE_MIDDLE: string;
  PROGRESS_FILLED_START: string;
  PROGRESS_UNFILLED_MIDDLE: string;
  PROGRESS_UNFILLED_END: string;
  PROGRESS_FILLED_MIDDLE: string;
}

export interface KoreanbotsConfig {
  KOREANBOTS_TOKEN: string;
  KOREANBOTS_CLIENT_ID: string;
  KOREANBOTS_UPDATE_INTERVAL: number;
}

export interface Config extends DiscordConfig, LavalinkConfig, EmbedConfig, AppConfig, ProgressBarConfig, KoreanbotsConfig {}

export interface ClientServices {
  commandManager: CommandManager;
  eventManager: EventManager;
  lavalinkManager: LavalinkManager;
  cooldownManager: CooldownManager;
  playerStateManager: PlayerStateManager;
}

export interface ClientStats {
  guilds: number;
  users: number;
  activePlayers: number;
  memoryUsage: number;
  cpuUsage: number;
}
