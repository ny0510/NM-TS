import {type HexColorString} from 'discord.js';

import type {Config} from '@/types/client';

export function getColors(config: Config): {normal: HexColorString; error: HexColorString} {
  return {
    normal: config.EMBED_COLOR_NORMAL as HexColorString,
    error: config.EMBED_COLOR_ERROR as HexColorString,
  };
}
