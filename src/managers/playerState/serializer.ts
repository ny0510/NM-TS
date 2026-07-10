import type {Client} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import type {PersistedQueueState} from '@/types/playerState';
import type {ILogger} from '@/shared/logger';
import {clearPlayerStates, replacePlayerStates} from './persistence';
import {toError} from '@/shared/errors';

export function serializeQueueState(queue: Queue): PersistedQueueState {
  const current = queue.getCurrent();
  const repeatMode = queue.trackRepeat ? 'track' : queue.queueRepeat ? 'queue' : 'off';

  return {
    guildId: queue.guildId,
    voiceChannelId: queue.voiceChannelId,
    textChannelId: queue.textChannelId,
    currentTrack: current
      ? {
          encoded: current.encoded,
          info: current.info,
          position: queue.position,
          paused: queue.paused,
          requesterId: current.requester?.id,
        }
      : null,
    tracks: queue.getTracks().map(track => ({
      encoded: track.encoded,
      info: track.info,
      requesterId: track.requester?.id,
    })),
    previous: queue.previous.map(track => ({
      encoded: track.encoded,
      info: track.info,
      requesterId: track.requester?.id,
    })),
    repeatMode,
    autoplay: queue.isAutoplay,
    autoplayRequesterId: queue.getAutoplayRequester()?.id,
    autoShuffle: queue.isAutoShuffle,
    volume: queue.volume,
    savedAt: Date.now(),
  };
}

export async function saveAllPlayerStates(client: Client, logger: ILogger): Promise<void> {
  const nmClient = client as unknown as NMClient;
  const queues = nmClient.queues;

  try {
    if (queues.size === 0) {
      await clearPlayerStates();
      logger.info('No active queues, deleted persisted player states if they existed');
      return;
    }

    const states: PersistedQueueState[] = [];

    for (const queue of queues.values()) {
      states.push(serializeQueueState(queue));
    }

    await replacePlayerStates(states);
  } catch (error) {
    logger.error(toError(error, 'Failed to save player state'));
  }
}
