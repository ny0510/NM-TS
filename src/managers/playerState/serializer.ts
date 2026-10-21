import type {NMClient} from '@/client';
import type {Queue} from '@/features/music/queue/Queue';
import type {RadioSession} from '@/features/radio/RadioSession';
import {toError} from '@/shared/errors';
import type {ILogger} from '@/shared/logger';
import type {PersistedPlaybackState, PersistedQueueState, PersistedRadioState} from '@/types/playerState';
import {clearPlayerStates, replacePlayerStates} from './persistence';

export function serializeQueueState(queue: Queue): PersistedQueueState {
  const current = queue.getCurrent();
  const repeatMode = queue.trackRepeat ? 'track' : queue.queueRepeat ? 'queue' : 'off';

  return {
    mode: 'music',
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

export function serializeRadioState(session: RadioSession): PersistedRadioState | undefined {
  if (!session.station || !session.regionKey) return undefined;
  return {mode: 'radio', guildId: session.guildId, voiceChannelId: session.voiceChannelId, textChannelId: session.textChannelId, regionKey: session.regionKey, stationId: session.station.id, volume: session.volume, paused: session.paused, requesterId: session.getCurrent()?.requester?.id, savedAt: Date.now()};
}

export async function saveAllPlayerStates(nmClient: NMClient, logger: ILogger): Promise<void> {
  const queues = nmClient.queues;

  try {
    if (nmClient.services.lavalinkManager.getSessions().size === 0) {
      await clearPlayerStates();
      logger.info('No active queues, deleted persisted player states if they existed');
      return;
    }

    const states: PersistedPlaybackState[] = [];

    for (const queue of queues.values()) {
      states.push(serializeQueueState(queue));
    }
    for (const session of nmClient.services.lavalinkManager.getSessions().values()) {
      if (session.mode !== 'radio') continue;
      const radio = nmClient.services.lavalinkManager.getRadioSession(session.guildId);
      const state = radio && serializeRadioState(radio);
      if (state) states.push(state);
    }

    await replacePlayerStates(states);
  } catch (error) {
    logger.error(toError(error, 'Failed to save player state'));
  }
}
