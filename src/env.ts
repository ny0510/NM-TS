import {createEnv} from '@t3-oss/env-core';
import type {HexColorString} from 'discord.js';
import {z} from 'zod';

import type {Config} from '@/types/client';

const hexColorSchema = z.custom<HexColorString>(value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value), '6자리 HEX 색상이어야 합니다.');
const defaultPresenceMessages = ['NM | {guilds}개의 서버에서 활동 중!', '/chart 명령어로 NM 음악 차트를 확인해 보세요!', '/favorites 명령어가 추가되었어요!', 'NM | {players}개의 서버에서 음악 재생 중!'];
const presenceMessagesSchema = z.preprocess(
  value => {
    if (typeof value !== 'string') return value;
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return value;
    }
  },
  z.array(z.string().min(1)).min(1),
);

export const env = createEnv({
  runtimeEnv: process.env,
  server: {
    DISCORD_TOKEN: z.string().min(1),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_GUILD_ID: z.string().min(1),
    DISCORD_LOG_WEBHOOK_URL: z.string().optional().default(''),
    LAVALINK_IDENTIFIER: z.string().optional().default(''),
    LAVALINK_HOST: z.string().optional().default(''),
    LAVALINK_PORT: z.coerce.number().int().positive().optional().default(2333),
    LAVALINK_PASSWORD: z.string().optional().default(''),
    LAVALINK_SECURE: z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform(value => value === 'true'),
    LAVALINK_SEARCH_PREFIX: z.string().optional().default('ytsearch:'),
    EMBED_COLOR_NORMAL: hexColorSchema,
    EMBED_COLOR_ERROR: hexColorSchema,
    DEFAULT_VOLUME: z.coerce.number().int().min(0).max(100).optional().default(50),
    LOG_PREFIX: z.string().min(1),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('production'),
    KOREANBOTS_TOKEN: z.string().optional().default(''),
    KOREANBOTS_CLIENT_ID: z.string().optional(),
    KOREANBOTS_UPDATE_INTERVAL: z.coerce.number().int().positive().optional().default(600_000),
    PRESENCE_UPDATE_INTERVAL_MS: z.coerce.number().int().positive().optional().default(10_000),
    PRESENCE_INITIAL_MESSAGE: z.string().min(1).optional().default('NM | 초기화 중..'),
    PRESENCE_MESSAGES: presenceMessagesSchema.optional().default(defaultPresenceMessages),
    PROGRESS_CIRCLE_START: z.string().optional().default('<:progress_circle_start:1411859909842309180>'),
    PROGRESS_CIRCLE_MIDDLE: z.string().optional().default('<:progress_circle_middle:1411859900723892305>'),
    PROGRESS_FILLED_START: z.string().optional().default('<:progress_filled_start:1411859892268175431>'),
    PROGRESS_UNFILLED_MIDDLE: z.string().optional().default('<:progress_unfilled_middle:1411859885175607306>'),
    PROGRESS_UNFILLED_END: z.string().optional().default('<:progress_unfilled_end:1411859876182757527>'),
    PROGRESS_FILLED_MIDDLE: z.string().optional().default('<:progress_filled_middle:1411859864921182329>'),
  },
});

export const config = {
  DISCORD_TOKEN: env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID: env.DISCORD_GUILD_ID,
  DISCORD_LOG_WEBHOOK_URL: env.DISCORD_LOG_WEBHOOK_URL,
  LAVALINK_IDENTIFIER: env.LAVALINK_IDENTIFIER,
  LAVALINK_HOST: env.LAVALINK_HOST,
  LAVALINK_PORT: env.LAVALINK_PORT,
  LAVALINK_PASSWORD: env.LAVALINK_PASSWORD,
  LAVALINK_SECURE: env.LAVALINK_SECURE,
  LAVALINK_SEARCH_PREFIX: env.LAVALINK_SEARCH_PREFIX,
  EMBED_COLOR_NORMAL: env.EMBED_COLOR_NORMAL,
  EMBED_COLOR_ERROR: env.EMBED_COLOR_ERROR,
  DEFAULT_VOLUME: env.DEFAULT_VOLUME,
  LOG_PREFIX: env.LOG_PREFIX,
  LOG_LEVEL: env.LOG_LEVEL,
  IS_DEV_MODE: env.NODE_ENV === 'development',
  KOREANBOTS_TOKEN: env.KOREANBOTS_TOKEN,
  KOREANBOTS_CLIENT_ID: env.KOREANBOTS_CLIENT_ID ?? env.DISCORD_CLIENT_ID,
  KOREANBOTS_UPDATE_INTERVAL: env.KOREANBOTS_UPDATE_INTERVAL,
  PRESENCE_UPDATE_INTERVAL_MS: env.PRESENCE_UPDATE_INTERVAL_MS,
  PRESENCE_INITIAL_MESSAGE: env.PRESENCE_INITIAL_MESSAGE,
  PRESENCE_MESSAGES: env.PRESENCE_MESSAGES,
  PROGRESS_CIRCLE_START: env.PROGRESS_CIRCLE_START,
  PROGRESS_CIRCLE_MIDDLE: env.PROGRESS_CIRCLE_MIDDLE,
  PROGRESS_FILLED_START: env.PROGRESS_FILLED_START,
  PROGRESS_UNFILLED_MIDDLE: env.PROGRESS_UNFILLED_MIDDLE,
  PROGRESS_UNFILLED_END: env.PROGRESS_UNFILLED_END,
  PROGRESS_FILLED_MIDDLE: env.PROGRESS_FILLED_MIDDLE,
} satisfies Config;
