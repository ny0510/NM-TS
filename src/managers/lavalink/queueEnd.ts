import {type Message, EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import {COLORS} from '@/shared/discord/embedColors';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {Logger} from '@/shared/logger';
import {destroyQueueSafely} from '@/features/music/queue/queueOperations';

const logger = new Logger('Lavalink');

export async function handleQueueEnd(queue: Queue, client: NMClient): Promise<void> {
  const channel = client.channels.cache.get(queue.textChannelId);

  queue.playing = false;
  queue.setCurrent(null);

  if (!channel?.isSendable()) return;
  if (queue.get('stoppedByCommand')) return;

  if (queue.isAutoplay) {
    logger.warn(`Autoplay enabled but queue ended for ${queue.guildId}`);
    try {
      await channel.send({
        embeds: [createErrorEmbed(client, '자동 재생할 곡을 찾지 못했어요.', '비슷한 곡을 찾을 수 없어 재생을 종료할게요.')],
      });
    } catch (e) {
      logger.warn(`Failed to send autoplay failure message: ${e}`);
    }
    queue.setAutoplay(false);
  }

  const embed = new EmbedBuilder().setTitle('대기열에 있는 음악을 모두 재생했어요. 30초 후에 자동으로 연결을 종료해요.').setColor(COLORS.normal);
  let message: Message | undefined;

  try {
    message = await channel.send({embeds: [embed]});
  } catch (sendError) {
    logger.warn(`Failed to send queue end message: ${sendError}`);
  }

  setTimeout(async () => {
    try {
      if (!queue.playing && queue.size() === 0) {
        await destroyQueueSafely(client, queue.guildId, `Queue destroyed after 30 seconds of inactivity (${queue.guildId})`);

        if (message?.editable) {
          await message.edit({embeds: [embed.setDescription('30초가 지나 자동으로 연결을 종료했어요.')]});
        }
      }
    } catch (error) {
      logger.warn(`Failed to edit queue end message: ${error}`);
    }
  }, 30_000);
}
