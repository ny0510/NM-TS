import type {HexColorString} from 'discord.js';

import type {Config} from '@/client/types';

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

  PROGRESS_CIRCLE_START: process.env.PROGRESS_CIRCLE_START || '<:progress_circle_start:1411859909842309180>',
  PROGRESS_CIRCLE_MIDDLE: process.env.PROGRESS_CIRCLE_MIDDLE || '<:progress_circle_middle:1411859900723892305>',
  PROGRESS_FILLED_START: process.env.PROGRESS_FILLED_START || '<:progress_filled_start:1411859892268175431>',
  PROGRESS_UNFILLED_MIDDLE: process.env.PROGRESS_UNFILLED_MIDDLE || '<:progress_unfilled_middle:1411859885175607306>',
  PROGRESS_UNFILLED_END: process.env.PROGRESS_UNFILLED_END || '<:progress_unfilled_end:1411859876182757527>',
  PROGRESS_FILLED_MIDDLE: process.env.PROGRESS_FILLED_MIDDLE || '<:progress_filled_middle:1411859864921182329>',
};
