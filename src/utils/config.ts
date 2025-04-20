import type {HexColorString} from 'discord.js';

import type {Config} from '@/interfaces/Config';

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_GUILD_ID || !process.env.EMBED_COLOR_NORMAL || !process.env.EMBED_COLOR_ERROR || !process.env.LOG_PREFIX) {
  throw new Error('Missing required environment variables. Please check your .env file.');
}

export const config: Config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '',

  LAVALINK_IDENTIFIER: process.env.LAVALINK_IDENTIFIER || '',
  LAVALINK_HOST: process.env.LAVALINK_HOST || '',
  LAVALINK_PORT: parseInt(process.env.LAVALINK_PORT!) || 2333,
  LAVALINK_PASSWORD: process.env.LAVALINK_PASSWORD || '',
  LAVALINK_SECURE: JSON.parse(process.env.LAVALINK_SECURE) || false,

  EMBED_COLOR_NORMAL: (process.env.EMBED_COLOR_NORMAL || '#b2d1bd') as HexColorString,
  EMBED_COLOR_ERROR: (process.env.EMBED_COLOR_ERROR || '#ff3333') as HexColorString,

  DEFAULT_VOLUME: parseInt(process.env.DEFAULT_VOLUME!) || 50,
  LOG_PREFIX: process.env.LOG_PREFIX || 'NM',
  IS_DEV_MODE: process.env.NODE_ENV == 'development',
};
