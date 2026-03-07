import {NMClient} from '@/client/Client';

const client = new NMClient();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  client.logger.info(`${signal} received. Shutting down gracefully...`);

  const destroyPromises = Array.from(client.services.lavalinkManager.getQueues().values()).map(queue => client.services.lavalinkManager.destroyQueue(queue.guildId));
  await Promise.allSettled(destroyPromises);

  client.destroy();
  process.exit(0);
};

process.on('unhandledRejection', (reason, promise) => client.logger.error(`Unhandled Rejection at: ${JSON.stringify(promise)}, reason: ${reason}`));
process.on('uncaughtException', e => client.logger.error(`Uncaught Exception: ${e}`));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
