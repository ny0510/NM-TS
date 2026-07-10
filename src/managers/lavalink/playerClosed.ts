import type {WebSocketClosedEvent} from 'shoukaku';

import {Logger} from '@/shared/logger';
import type {PlayerEventContext} from './types';

const logger = new Logger('Lavalink');

export const handlePlayerClosed = (ctx: PlayerEventContext, data: WebSocketClosedEvent): void => {
  const {guildName, guildId} = ctx;

  if (data.code === 1000) {
    logger.debug(`Player ${guildName} (${guildId}) websocket closed normally (code: 1000)`);
    return;
  }
  logger.warn(`Player ${guildName} (${guildId}) websocket closed (code: ${data.code}, reason: ${data.reason})`);
};
