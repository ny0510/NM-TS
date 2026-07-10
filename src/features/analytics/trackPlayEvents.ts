import {getDb} from '@/db';
import {trackPlayEvents} from '@/db/schema';
import type {QueueTrack} from '@/types/music';
import {upsertTrack} from '@/db/trackUpsert';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import {extractTrackMeta} from '@/features/music/meta';

const logger = new Logger('TrackPlayEvents');

export async function recordTrackPlayEvent(guildId: string, track: QueueTrack, requesterId?: string): Promise<void> {
  const resolvedRequesterId = requesterId ?? track.requester?.id;

  if (!resolvedRequesterId) {
    logger.debug(`요청자가 없어 재생 기록을 저장하지 않았어요. track=${track.info.title}`);
    return;
  }

  const {source, identifier, title, artist, durationMs} = extractTrackMeta(track);
  const playedAt = new Date();
  const playContext = track.playContext?.playContext ?? (track.isAutoplay ? 'autoplay' : 'play');
  const requestChannelId = track.playContext?.requestChannelId ?? null;
  const endedReason = track.playContext?.endedReason ?? 'finished';
  const queueType = track.isAutoplay ? 'autoplay' : 'queue';

  if (!identifier || !title) {
    logger.warn(`트랙 메타데이터가 부족해 재생 기록을 저장하지 않았어요. guild=${guildId}`);
    return;
  }

  const db = getDb();

  try {
    await db.transaction(async tx => {
      const savedTrack = await upsertTrack(tx, {
        source,
        identifier,
        title,
        artist,
        durationMs,
        uri: track.info.uri ?? null,
        artworkUrl: track.info.artworkUrl ?? null,
      });

      await tx.insert(trackPlayEvents).values({
        guildId,
        userId: resolvedRequesterId,
        trackId: savedTrack.id,
        playedAt,
        isAutoplay: track.isAutoplay ?? false,
        endedReason,
        requestChannelId,
        playContext,
        queueType,
      });
    });
  } catch (error) {
    logger.error(toError(error, '재생 기록 저장 중 오류가 발생했어요'));
  }
}
