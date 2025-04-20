import type {HexColorString} from 'discord.js';

export interface Config {
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_GUILD_ID: string;

  LAVALINK_IDENTIFIER: string;
  LAVALINK_HOST: string;
  LAVALINK_PORT: number;
  LAVALINK_PASSWORD: string;
  LAVALINK_SECURE: boolean;

  EMBED_COLOR_NORMAL: HexColorString;
  EMBED_COLOR_ERROR: HexColorString;

  DEFAULT_VOLUME: number;
  LOG_PREFIX: string;
  IS_DEV_MODE: boolean;
}
