import type {QueueTrack} from '@/types/music';

export interface ExtractedTrackMeta {
  source: string;
  identifier: string | undefined;
  title: string | undefined;
  artist: string;
  durationMs: number;
}

/**
 * QueueTrack.info의 메타데이터를 정규화된 객체로 추출합니다.
 *
 * - `source`, `artist`: 빈 값은 `'unknown'`으로 대체
 * - `identifier`, `title`: `undefined`를 그대로 유지 (호출부에서 falsy 검사)
 * - `durationMs`: `undefined`는 `0`으로 대체
 */
export function extractTrackMeta(track: QueueTrack): ExtractedTrackMeta {
  return {
    source: track.info.sourceName?.trim() || 'unknown',
    identifier: track.info.identifier?.trim(),
    title: track.info.title?.trim(),
    artist: track.info.author?.trim() || 'unknown',
    durationMs: track.info.length ?? 0,
  };
}
