import {EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client';
import {COLORS} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';

export const setupErrorHandlers = (client: NMClient): void => {
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    client.logger.info(`${signal} received. Shutting down gracefully...`);

    try {
      await client.services.playerStateManager.saveAll();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      client.logger.error(toError(error, 'Failed to save player state'));
    }

    const queues = [...client.queues.values()];
    await Promise.allSettled(
      queues.map(async queue => {
        const channel = client.channels.cache.get(queue.textChannelId);
        if (!channel?.isSendable()) return;

        try {
          await channel.send({
            embeds: [new EmbedBuilder().setTitle('NM이 재시작 중이에요.').setDescription('잠시 후 이전 재생 상태가 자동으로 복구돼요.').setColor(COLORS.normal)],
          });
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          client.logger.error(toError(error, `Failed to notify guild ${queue.guildId} before shutdown`));
        }
      }),
    );

    await Promise.allSettled(queues.map(queue => client.services.lavalinkManager.destroyQueue(queue.guildId)));
    await client.destroy();
    process.exit(0);
  };

  process.on('unhandledRejection', (reason, promise) => client.logger.error(toError(reason, `Unhandled Rejection at: ${JSON.stringify(promise)}, reason`)));
  process.on('uncaughtException', error => {
    client.logger.error(toError(error, 'Uncaught Exception'));
    process.exit(1);
  });
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
};
