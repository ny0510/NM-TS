import type {AutocompleteInteraction, ChatInputCommandInteraction, ClientEvents, HexColorString, PermissionResolvable, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder} from 'discord.js';

import type {CooldownManager} from '@/managers/CooldownManager';
import type {LavalinkManager} from '@/managers/LavalinkManager';
import type {PlayerStateManager} from '@/managers/PlayerStateManager';
import type {LogLevel} from '@/types/logger';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  permissions?: PermissionResolvable[];
  cooldown?: number;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  runOnce?: boolean;
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
  LOG_LEVEL: LogLevel;
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

export interface PresenceConfig {
  readonly PRESENCE_UPDATE_INTERVAL_MS: number;
  readonly PRESENCE_INITIAL_MESSAGE: string;
  readonly PRESENCE_MESSAGES: readonly string[];
}

export interface Config extends DiscordConfig, LavalinkConfig, EmbedConfig, AppConfig, ProgressBarConfig, KoreanbotsConfig, PresenceConfig {}

export interface ClientServices {
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
