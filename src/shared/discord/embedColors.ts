import {type HexColorString} from 'discord.js';

import {config} from '@/shared/config';

export const COLORS = {
  normal: config.EMBED_COLOR_NORMAL as HexColorString,
  error: config.EMBED_COLOR_ERROR as HexColorString,
} as const;
