import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import {handlePlayerClosed} from './playerClosed';
import {handleTrackEnd} from './trackEnd';
import {handleTrackException} from './trackException';
import {handleTrackStart} from './trackStart';
import {handleTrackStuck} from './trackStuck';
import type {PlayerEventContext} from './types';

const logger = new Logger('Lavalink');

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

  shoukaku.on('ready', (name: string, lavalinkResume: boolean, libraryResume: boolean) => {
    logger.info(`Node ${name} connected (lavalinkResume: ${lavalinkResume}, libraryResume: ${libraryResume})`);
  });

  shoukaku.on('error', (name: string, error: unknown) => logger.error(toError(error, `Node ${name} error`)));
  shoukaku.on('close', (name: string, code: number, reason: string) => logger.warn(`Node ${name} closed (code: ${code}, reason: ${reason})`));
  shoukaku.on('disconnect', (name: string, count: number) => logger.warn(`Node ${name} disconnected (${count} players affected)`));
  shoukaku.on('reconnecting', (name: string, reconnectsLeft: number, interval: number) => logger.info(`Node ${name} reconnecting... (${reconnectsLeft} tries left, interval: ${interval}s)`));
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
