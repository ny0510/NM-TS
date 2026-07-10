import type {QueueTrack} from '@/types/music';

export const MAX_QUEUE_SIZE = 10_000;

// ────────────────────────────────────────────
// Shuffle
// ────────────────────────────────────────────

/** Fisher-Yates shuffle — returns new array, does not mutate input. */
export const shuffleQueue = (tracks: QueueTrack[]): QueueTrack[] => {
  const result = [...tracks];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i]!, result[j]!] = [result[j]!, result[i]!];
  }
  return result;
};

/** Round-robin shuffle by requester — returns new array, does not mutate input. */
export const roundRobinShuffle = (tracks: QueueTrack[]): QueueTrack[] => {
  const byRequester = new Map<string, QueueTrack[]>();

  for (const track of tracks) {
    const id = track.requester?.id ?? 'unknown';
    const list = byRequester.get(id);
    if (list) {
      list.push(track);
    } else {
      byRequester.set(id, [track]);
    }
  }

  for (const requesterTracks of byRequester.values()) {
    for (let i = requesterTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [requesterTracks[i]!, requesterTracks[j]!] = [requesterTracks[j]!, requesterTracks[i]!];
    }
  }

  const requesters = [...byRequester.keys()];
  for (let i = requesters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [requesters[i]!, requesters[j]!] = [requesters[j]!, requesters[i]!];
  }

  const result: QueueTrack[] = [];
  let hasMore = true;

  while (hasMore) {
    hasMore = false;
    for (const id of requesters) {
      const requesterTracks = byRequester.get(id);
      if (requesterTracks && requesterTracks.length > 0) {
        const track = requesterTracks.shift();
        if (track) result.push(track);
        if (requesterTracks.length > 0) hasMore = true;
      }
    }
  }

  return result;
};

// ────────────────────────────────────────────
// Add / Remove
// ────────────────────────────────────────────

/**
 * Add track(s) to the tracks array in place.
 * Returns `false` if the queue would exceed MAX_QUEUE_SIZE.
 */
export const addTracks = (
  tracks: QueueTrack[],
  trackOrTracks: QueueTrack | QueueTrack[],
  position?: number,
): boolean => {
  const tracksToAdd = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
  if (tracks.length + tracksToAdd.length > MAX_QUEUE_SIZE) {
    return false;
  }
  if (position !== undefined && position >= 0) {
    tracks.splice(position, 0, ...tracksToAdd);
  } else {
    tracks.push(...tracksToAdd);
  }
  return true;
};

/** Remove a track at the given index from the tracks array (mutates in place). */
export const removeTrack = (tracks: QueueTrack[], index: number): QueueTrack | undefined => {
  if (index < 0 || index >= tracks.length) return undefined;
  return tracks.splice(index, 1)[0];
};
