import type {QueueTrack} from '@/types/music';
import {coverPattern} from '@/shared/formatting';

export function isCoverTrack(track: QueueTrack): boolean {
  return coverPattern.test(track.info.title) || coverPattern.test(track.info.author);
}

export function isShortsTrack(track: QueueTrack): boolean {
  const isDurationShorts = track.info.length !== undefined && track.info.length > 0 && track.info.length <= 60000;
  const hasShortsTags = /#shorts/i.test(track.info.title);

  return isDurationShorts || hasShortsTags;
}

export interface FilterResult {
  tracks: QueueTrack[];
  filteredCount: number;
  errorMessage: string;
}

export function filterTracksWithOptions(tracks: QueueTrack[], excludeCover: boolean, excludeShorts: boolean, contextLabel: string = '검색된'): FilterResult {
  const originalTracksCount = tracks.length;
  let filteredTracks = tracks;

  if (excludeCover && excludeShorts) {
    filteredTracks = tracks.filter(track => !isCoverTrack(track) && !isShortsTrack(track));
  } else if (excludeCover) {
    filteredTracks = tracks.filter(track => !isCoverTrack(track));
  } else if (excludeShorts) {
    filteredTracks = tracks.filter(track => !isShortsTrack(track));
  }

  let errorMessage = '';
  if (filteredTracks.length === 0) {
    if (excludeCover && excludeShorts) {
      errorMessage = `${contextLabel} ${originalTracksCount}곡이 모두 커버 곡 또는 쇼츠로 판단되었어요.`;
    } else if (excludeCover) {
      errorMessage = `${contextLabel} ${originalTracksCount}곡이 모두 커버 곡으로 판단되었어요.`;
    } else if (excludeShorts) {
      errorMessage = `${contextLabel} ${originalTracksCount}곡이 모두 쇼츠로 판단되었어요.`;
    }
  }

  return {
    tracks: filteredTracks,
    filteredCount: originalTracksCount - filteredTracks.length,
    errorMessage,
  };
}
