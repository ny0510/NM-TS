import type {TrackEndEvent} from 'shoukaku';

import type {QueueTrack} from '@/types/music';
import {Logger} from '@/shared/logger';
import {recordTrackPlayEvent} from '@/features/analytics/trackPlayEvents';
import type {PlayerEventContext} from './types';
import {handleAutoplay} from './autoplay';
import {handleQueueEnd} from './queueEnd';

const logger = new Logger('Lavalink');
const MIN_REPEAT_PLAYBACK_MS = 5_000;

export function shouldRestartRepeatedTrack(startedAt: number | undefined, endedAt: number): boolean {
  return startedAt === undefined || endedAt - startedAt >= MIN_REPEAT_PLAYBACK_MS;
}

export const handleTrackEnd = async (ctx: PlayerEventContext, data: TrackEndEvent): Promise<void> => {
  const {queue, client, guildName, guildId} = ctx;
  const track = data.track as QueueTrack;

  logger.info(`Player ${guildName} (${guildId}) track end. Track: ${track.info.title} (reason: ${data.reason})`);

  if (data.reason === 'replaced') return;

  const currentTrack = queue.getCurrent();
  const requesterId = currentTrack?.requester?.id ?? track.requester?.id;
  const playContext = currentTrack?.playContext ?? track.playContext ?? {playContext: 'play', requestChannelId: queue.textChannelId, endedReason: data.reason};

  if (currentTrack) currentTrack.playContext = {...playContext, endedReason: data.reason};
  track.playContext = {...playContext, endedReason: data.reason};

  if (currentTrack) {
    await recordTrackPlayEvent(queue.guildId, currentTrack, requesterId);
  } else {
    await recordTrackPlayEvent(queue.guildId, track, requesterId);
  }

  if (queue.trackRepeat && data.reason === 'finished') {
    const startedAt = queue.get<number>('trackStartedAt');
    if (shouldRestartRepeatedTrack(startedAt, Date.now())) {
      await queue.player.playTrack({track: {encoded: track.encoded}});
      return;
    }

    queue.setTrackRepeat(false);
    logger.warn(`Player ${guildName} (${guildId}) track repeat stopped after playback ended within five seconds. Track: ${track.info.title}`);
  }

  if (queue.queueRepeat && data.reason === 'finished') {
    const currentTrack = queue.getCurrent();
    if (currentTrack) queue.add(currentTrack);
  }

  if (track) {
    queue.addToPrevious(track);
  }

  if (queue.size() > 0) {
    await queue.play();
    return;
  }

  if (queue.isAutoplay && data.reason === 'finished') {
    const autoplaySuccess = await handleAutoplay(queue, client);
    if (autoplaySuccess) return;
  }

  await handleQueueEnd(queue, client);
};
