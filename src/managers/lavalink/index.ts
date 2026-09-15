import {EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client';
import type {Queue} from '@/features/music/queue/Queue';
import {COLORS} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import {handlePlayerClosed} from './playerClosed';
import {handleTrackEnd} from './trackEnd';
import {handleTrackException} from './trackException';
import {handleTrackStart} from './trackStart';
import {handleTrackStuck} from './trackStuck';
import type {PlayerEventContext} from './types';

const logger = new Logger('Lavalink');

const notifyActiveQueues = async (client: NMClient, title: string, description: string): Promise<void> => {
  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(COLORS.normal);
  const sends = Array.from(client.services.lavalinkManager.getQueues().values()).map(async queue => {
    const channel = client.channels.cache.get(queue.textChannelId);
    if (!channel?.isSendable()) return;
    await channel.send({embeds: [embed]});
  });

  await Promise.allSettled(sends);
};

export type {PlayerEventContext} from './types';
export {handlePlayerClosed} from './playerClosed';
export {handleTrackEnd} from './trackEnd';
export {handleTrackException} from './trackException';
export {handleTrackStart} from './trackStart';
export {handleTrackStuck} from './trackStuck';
export {handleAutoplay} from './autoplay';
export {handleQueueEnd} from './queueEnd';

/** Register Lavalink node-level events (ready, error, close, disconnect, reconnecting, debug). */
export const registerLavalinkEvents = (client: NMClient): void => {
  const shoukaku = client.services.lavalinkManager.getShoukaku();
  const reconnectingNodes = new Set<string>();

  const notifyReconnecting = (name: string): void => {
    if (reconnectingNodes.has(name)) return;
    reconnectingNodes.add(name);
    void notifyActiveQueues(client, '음악 서버가 재시작 중이에요.', '재연결을 시도하고 있어요. 잠시만 기다려 주세요.');
  };

  shoukaku.on('ready', (name: string, lavalinkResume: boolean, libraryResume: boolean) => {
    logger.info(`Node ${name} connected (lavalinkResume: ${lavalinkResume}, libraryResume: ${libraryResume})`);
    if (reconnectingNodes.delete(name)) {
      void notifyActiveQueues(client, '음악 서버 연결이 복구됐어요.', '이제 음악을 다시 재생할 수 있어요.');
    }
  });

  shoukaku.on('error', (name: string, error: unknown) => {
    logger.error(toError(error, `Node ${name} error`));
    client.services.lavalinkManager.restoreNode(name);
  });
  shoukaku.on('close', (name: string, code: number, reason: string) => {
    logger.warn(`Node ${name} closed (code: ${code}, reason: ${reason})`);
    notifyReconnecting(name);
  });
  shoukaku.on('reconnecting', (name: string, reconnectsLeft: number, interval: number) => {
    logger.info(`Node ${name} reconnecting... (${reconnectsLeft} tries left, interval: ${interval}s)`);
    notifyReconnecting(name);
  });
  shoukaku.on('debug', (name: string, info: string) => logger.debug(`[${name}] ${info}`));
};

/** Register player-level events (start, end, stuck, exception, closed). */
export const registerPlayerEvents = (queue: Queue, client: NMClient): void => {
  const {player, guildId} = queue;
  const guildName = client.guilds.cache.get(guildId)?.name ?? guildId;

  logger.info(`Player ${guildName} (${guildId}) created`);

  const ctx: PlayerEventContext = {queue, client, guildName, guildId};

  player.on('start', async data => { await handleTrackStart(ctx, data); });
  player.on('end', async data => { await handleTrackEnd(ctx, data); });
  player.on('stuck', async data => { await handleTrackStuck(ctx, data); });
  player.on('exception', async data => { await handleTrackException(ctx, data); });
  player.on('closed', data => { handlePlayerClosed(ctx, data); });
};
