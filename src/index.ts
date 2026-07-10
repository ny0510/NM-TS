import {EmbedBuilder} from 'discord.js';

import {NMClient} from '@/client/Client';
import {getColors} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';

const client = new NMClient();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  client.logger.info(`${signal} received. Shutting down gracefully...`);

  try {
    await client.services.playerStateManager.saveAll();
  } catch (error) {
    client.logger.error(toError(error, 'Failed to save player state'));
  }

  const activeQueues = Array.from(client.services.lavalinkManager.getQueues().values());
  const notifyPromises = activeQueues.map(async (queue: import('@/features/music/queue/Queue').Queue) => {
    const channel = client.channels.cache.get(queue.textChannelId);
    if (channel?.isSendable()) {
      try {
        await channel.send({
          embeds: [new EmbedBuilder().setTitle('NM이 재시작 중이에요.').setDescription('잠시 후 이전 재생 상태가 자동으로 복구돼요.').setColor(getColors(client.config).normal)],
        });
      } catch {
      }
    }
  });
  await Promise.allSettled(notifyPromises);

  const destroyPromises = Array.from(client.services.lavalinkManager.getQueues().values()).map((queue: import('@/features/music/queue/Queue').Queue) => client.services.lavalinkManager.destroyQueue(queue.guildId));
  await Promise.allSettled(destroyPromises);

  client.destroy();
  process.exit(0);
};

process.on('unhandledRejection', (reason, promise) => client.logger.error(toError(reason, `Unhandled Rejection at: ${JSON.stringify(promise)}, reason`)));
process.on('uncaughtException', e => client.logger.error(toError(e, 'Uncaught Exception')));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
