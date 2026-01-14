import {EmbedBuilder} from 'discord.js';

import {NMClient} from '@/client/Client';
import {saveAllSessions} from '@/utils/music/sessionManager';

const client = new NMClient();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  client.logger.info(`${signal} received. Shutting down gracefully...`);

  // 모든 플레이어 세션 저장
  await saveAllSessions(client);

  // 모든 플레이어에게 종료 메시지 전송
  const notifyPromises = Array.from(client.manager.players.values()).map(async player => {
    const channel = client.channels.cache.get(player.textChannelId || '');
    if (channel?.isSendable()) {
      try {
        await channel.send({
          embeds: [new EmbedBuilder().setTitle('⚠️ 봇이 재시작 중이에요.').setDescription('잠시만 기다려 주세요. 곧 다시 돌아올게요!').setColor(client.config.EMBED_COLOR_NORMAL)],
        });
      } catch {
        // 메시지 전송 실패 시 무시
      }
    }
  });

  await Promise.allSettled(notifyPromises);

  // 클라이언트 종료
  await client.destroy();
  process.exit(0);
};

process.on('unhandledRejection', (reason, promise) => client.logger.error(`Unhandled Rejection at: ${JSON.stringify(promise)}, reason: ${reason}`));
process.on('uncaughtException', e => client.logger.error(`Uncaught Exception: ${e}`));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
