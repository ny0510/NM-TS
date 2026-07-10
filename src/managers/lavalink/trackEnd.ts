import type {TrackEndEvent} from 'shoukaku';

import type {QueueTrack} from '@/types/music';
import {Logger} from '@/shared/logger';
import {recordTrackPlayEvent} from '@/features/analytics/trackPlayEvents';
import type {PlayerEventContext} from './types';
import {handleAutoplay} from './autoplay';
import {handleQueueEnd} from './queueEnd';

const logger = new Logger('Lavalink');

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
    await queue.player.playTrack({track: {encoded: track.encoded}});
    return;
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
