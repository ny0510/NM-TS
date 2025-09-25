import {type AutocompleteInteraction, type ChatInputCommandInteraction, type HexColorString, PermissionsBitField, SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder} from 'discord.js';

// Command 인터페이스
export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  permissions?: PermissionsBitField[] | bigint[];
  cooldown?: number;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

// Event 인터페이스
export interface Event {
  name: string;
  once?: boolean | false;
  execute(...args: any): Promise<void> | void;
}

// Config 인터페이스들
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

export interface Config extends DiscordConfig, LavalinkConfig, EmbedConfig, AppConfig, ProgressBarConfig {}

// Client 인터페이스들
export interface ClientServices {
  commandManager: import('@/managers/CommandManager').CommandManager;
  eventManager: import('@/managers/EventManager').EventManager;
  lavalinkManager: import('@/managers/LavalinkManager').LavalinkManager;
  cooldownManager: import('@/managers/CooldownManager').CooldownManager;
}

export interface ClientStats {
  guilds: number;
  users: number;
  activePlayers: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}
