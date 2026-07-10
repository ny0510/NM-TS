import type {Player} from 'shoukaku';

import type {QueueTrack} from '@/types/music';

/**
 * Shift the next track from the queue, set play context if missing,
 * and begin playback on the player.
 */
export const shiftAndPlay = async (
  tracks: QueueTrack[],
  player: Player,
  volume: number,
  textChannelId: string,
): Promise<{track: QueueTrack | null; playing: boolean}> => {
  const track = tracks.shift();
  if (!track) return {track: null, playing: false};

  if (!track.playContext) {
    track.playContext = {
      playContext: 'play',
      requestChannelId: textChannelId,
    };
  }

  await player.playTrack({track: {encoded: track.encoded}});
  await player.setGlobalVolume(volume);
  return {track, playing: true};
};

/**
 * Optionally trim leading tracks from the array, then stop the player.
 */
export const stopAndTrim = async (tracks: QueueTrack[], player: Player, count?: number): Promise<void> => {
  if (count && count > 1) {
    const removeCount = Math.min(count - 1, tracks.length);
    tracks.splice(0, removeCount);
  }
  await player.stopTrack();
};
