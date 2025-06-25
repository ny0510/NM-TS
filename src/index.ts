import {NMClient} from '@/client/Client';

const client = new NMClient();

const gracefulShutdown = (signal: string) => {
  client.logger.info(`${signal} received. Shutting down gracefully...`);
  client.destroy();
  process.exit(0);
};

process.on('unhandledRejection', (reason, promise) => client.logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`));
process.on('uncaughtException', e => client.logger.error(`Uncaught Exception: ${e}`));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
