import {EmbedBuilder} from 'discord.js';
import type {TrackStartEvent} from 'shoukaku';

import type {QueueTrack} from '@/types/music';
import {COLORS} from '@/shared/discord/embedColors';
import {hyperlink, truncateWithEllipsis} from '@/shared/formatting';
import {Logger} from '@/shared/logger';
import {createPlayerControls} from '@/features/music/button/controlsBuilder';
import {createQuickAddButton} from '@/features/music/button/quickAddBuilder';
import {getEmbedMeta} from '@/features/music/track/embeds';
import type {PlayerEventContext} from './types';

const logger = new Logger('Lavalink');

export const handleTrackStart = async (ctx: PlayerEventContext, data: TrackStartEvent): Promise<void> => {
  const {queue, client, guildName, guildId} = ctx;
  const track = data.track as QueueTrack;

  logger.info(`Player ${guildName} (${guildId}) track start. Track: ${track.info.title}`);

  const channel = client.channels.cache.get(queue.textChannelId);
  const isTrackRepeating = queue.trackRepeat;

  /* 복구 중에는 track start embed 억제 */
  if (queue.get<boolean>('isRestoring')) return;

  if (!channel?.isSendable() || isTrackRepeating) return;

  try {
    const lastMessageId = queue.get<string>('lastMessageId');
    if (lastMessageId && channel.isSendable()) {
      try {
        const lastMessage = await channel.messages.fetch(lastMessageId);
        if (lastMessage?.editable) {
          await lastMessage.edit({components: [createQuickAddButton()]});
        }
      } catch {
        /* 메시지가 삭제되었거나 권한이 없는 경우 무시 */
      }
    }

    const trackMeta = await getEmbedMeta(track, false, queue, 'play');

    const message = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`♪ ${hyperlink(truncateWithEllipsis(track.info.title, 50), track.info.uri ?? '')}`)
          .setURL(track.info.uri ?? null)
          .setFooter({text: trackMeta.footerText})
          .setColor(COLORS.normal),
      ],
      components: [createPlayerControls(queue, track.info.uri ?? '')],
    });

    queue.set('lastMessageId', message.id);
  } catch (error) {
    logger.warn(`Failed to send track start message: ${error}`);
  }
};
