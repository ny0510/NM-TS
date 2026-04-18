import {EmbedBuilder, type TextChannel} from 'discord.js';

import {NMClient} from '@/client/Client';

const client = new NMClient();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  client.logger.info(`${signal} received. Shutting down gracefully...`);

  try {
    await client.services.playerStateManager.saveAll();
  } catch (error) {
    client.logger.error(`Failed to save player state: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 종료 전 활성 큐에 알림 전송
  const activeQueues = Array.from(client.services.lavalinkManager.getQueues().values());
  const notifyPromises = activeQueues.map(async queue => {
    const channel = client.channels.cache.get(queue.textChannelId);
    if (channel?.isSendable()) {
      try {
        await channel.send({
          embeds: [new EmbedBuilder().setTitle('봇이 재시작 중이에요.').setDescription('잠시 후 다시 시작되면 이전 재생 상태가 자동으로 복구돼요.').setColor(client.config.EMBED_COLOR_NORMAL)],
        });
      } catch {
        // 알림 전송 실패 무시
      }
    }
  });
  await Promise.allSettled(notifyPromises);

  const destroyPromises = Array.from(client.services.lavalinkManager.getQueues().values()).map(queue => client.services.lavalinkManager.destroyQueue(queue.guildId));
  await Promise.allSettled(destroyPromises);

  client.destroy();
  process.exit(0);
};

process.on('unhandledRejection', (reason, promise) => client.logger.error(`Unhandled Rejection at: ${JSON.stringify(promise)}, reason: ${reason}`));
process.on('uncaughtException', e => client.logger.error(`Uncaught Exception: ${e}`));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
