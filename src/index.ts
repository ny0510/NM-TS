import {EmbedBuilder} from 'discord.js';

import {NMClient} from '@/client/Client';

const client = new NMClient();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  client.logger.info(`${signal} received. Shutting down gracefully...`);

  try {
    const savedCount = await client.services.lavalinkManager.saveSessions();
    if (savedCount > 0) {
      client.logger.info(`Saved ${savedCount} session(s) for restoration`);
    }
  } catch (error) {
    client.logger.error(`Failed to save sessions: ${error}`);
  }

  const notifyPromises = Array.from(client.queues.values()).map(async queue => {
    const channel = client.channels.cache.get(queue.textChannelId || '');
    if (channel?.isSendable()) {
      try {
        await channel.send({
          embeds: [new EmbedBuilder().setTitle('⚠️ 봇이 재시작 중이에요.').setDescription('잠시만 기다려 주세요. 곧 다시 돌아올게요!').setColor(client.config.EMBED_COLOR_NORMAL)],
        });
      } catch {
        client.logger.warn(`Failed to send shutdown message to guild ${queue.guildId}`);
      }
    }
  });

  await Promise.allSettled(notifyPromises);

  process.exit(0);
};

process.on('unhandledRejection', (reason, promise) => client.logger.error(`Unhandled Rejection at: ${JSON.stringify(promise)}, reason: ${reason}`));
process.on('uncaughtException', e => client.logger.error(`Uncaught Exception: ${e}`));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
