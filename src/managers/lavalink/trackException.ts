import {codeBlock} from 'discord.js';
import type {TrackExceptionEvent} from 'shoukaku';

import {createErrorEmbed} from '@/shared/discord/embeds';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import type {PlayerEventContext} from './types';

const logger = new Logger('Lavalink');

export const handleTrackException = async (ctx: PlayerEventContext, data: TrackExceptionEvent): Promise<void> => {
  const {queue, client, guildName, guildId} = ctx;
  const {exception} = data;
  const errorMessage = exception.message ?? 'Unknown Error';

  logger.error(`Player ${guildName} (${guildId}) track exception [${exception.severity}]: ${errorMessage}`);

  const channel = client.channels.cache.get(queue.textChannelId);
  if (!channel?.isSendable()) return;

  const isPlaybackRestricted = exception.severity !== 'fault';

  try {
    await channel.send({
      embeds: [isPlaybackRestricted ? createErrorEmbed(client, '재생이 불가능한 영상이에요.', '유튜브 정책에 의해 재생이 제한된 영상이에요.\n연령 제한, 지역 제한 등이 원인일 수 있어요.') : createErrorEmbed(client, '음악 재생 중 오류가 발생했어요.', codeBlock('js', errorMessage))],
    });
  } catch (sendError) {
    logger.error(toError(sendError, 'Failed to send track error message'));
  }
};
