import {getDb} from '@/db';
import {trackPlayEvents, tracks} from '@/db/schema';
import type {QueueTrack} from '@/types/music';
import {Logger} from '@/utils/logger';

const logger = new Logger('TrackPlayEvents');

export async function recordTrackPlayEvent(guildId: string, track: QueueTrack, requesterId?: string): Promise<void> {
  const resolvedRequesterId = requesterId ?? track.requester?.id;

  if (!resolvedRequesterId) {
    logger.debug(`요청자가 없어 재생 기록을 저장하지 않았어요. track=${track.info.title}`);
    return;
  }

  const source = track.info.sourceName?.trim() || 'unknown';
  const identifier = track.info.identifier?.trim();
  const title = track.info.title?.trim();
  const artist = track.info.author?.trim() || 'unknown';
  const durationMs = track.info.length ?? 0;
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
      const [savedTrack] = await tx
        .insert(tracks)
        .values({
          source,
          identifier,
          title,
          artist,
          durationMs,
          uri: track.info.uri ?? null,
          artworkUrl: track.info.artworkUrl ?? null,
        })
        .onConflictDoUpdate({
          target: [tracks.source, tracks.identifier],
          set: {
            title,
            artist,
            durationMs,
            uri: track.info.uri ?? null,
            artworkUrl: track.info.artworkUrl ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({id: tracks.id});

      if (!savedTrack) {
        throw new Error('트랙 정보를 저장하지 못했어요.');
      }

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
    logger.error(error instanceof Error ? error : new Error(`재생 기록 저장 중 오류가 발생했어요: ${error}`));
  }
}
