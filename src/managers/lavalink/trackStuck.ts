import {EmbedBuilder} from 'discord.js';
import type {TrackStuckEvent} from 'shoukaku';

import {getColors} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import type {PlayerEventContext} from './types';

const logger = new Logger('Lavalink');

export const handleTrackStuck = async (ctx: PlayerEventContext, data: TrackStuckEvent): Promise<void> => {
  const {queue, client, guildName, guildId} = ctx;

  logger.warn(`Player ${guildName} (${guildId}) track stuck. Threshold: ${data.thresholdMs}ms`);

  const channel = client.channels.cache.get(queue.textChannelId);
  if (!channel?.isSendable()) return;

  try {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`음악이 ${data.thresholdMs / 1000}초 동안 재생되지 않았어요.`)
          .setDescription('다음 음악으로 넘어갈게요.')
          .setColor(getColors(client.config).error),
      ],
    });
  } catch (sendError) {
    logger.error(toError(sendError, 'Failed to send track stuck message'));
  }

  await queue.stop();
};
