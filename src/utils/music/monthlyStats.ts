import {and, desc, eq, sql} from 'drizzle-orm';
import {DateTime} from 'luxon';

import {getDb} from '@/db';
import {monthlyTrackPlays, tracks} from '@/db/schema';
import type {QueueTrack} from '@/types/music';
import {Logger} from '@/utils/logger';

const logger = new Logger('MonthlyStats');

export interface MonthlyTrackRankingRow {
  trackId: number;
  title: string;
  source: string;
  identifier: string;
  uri: string | null;
  artworkUrl: string | null;
  playCount: number;
}

export function getCurrentMonthStart(): Date {
  return DateTime.utc().startOf('month').toJSDate();
}

export function parseMonthInput(value: string): Date | null {
  const parsed = DateTime.fromFormat(value.trim(), 'yyyy-MM', {zone: 'utc'}).startOf('month');
  return parsed.isValid ? parsed.toJSDate() : null;
}

export function formatMonthLabel(month: Date): string {
  return DateTime.fromJSDate(month, {zone: 'utc'}).toFormat('yyyy-MM');
}

export async function recordMonthlyTrackPlay(guildId: string, track: QueueTrack, requesterId?: string): Promise<void> {
  const resolvedRequesterId = requesterId ?? track.requester?.id;

  if (!resolvedRequesterId) {
    logger.debug(`요청자가 없어 월간 재생 기록을 저장하지 않았어요. track=${track.info.title}`);
    return;
  }

  const source = track.info.sourceName?.trim() || 'unknown';
  const identifier = track.info.identifier?.trim();
  const title = track.info.title?.trim();

  if (!identifier || !title) {
    logger.warn(`트랙 메타데이터가 부족해 월간 재생 기록을 저장하지 않았어요. guild=${guildId}`);
    return;
  }

  const db = getDb();

  const month = getCurrentMonthStart();

  try {
    await db.transaction(async tx => {
      const [savedTrack] = await tx
        .insert(tracks)
        .values({
          source,
          identifier,
          title,
          uri: track.info.uri ?? null,
          artworkUrl: track.info.artworkUrl ?? null,
        })
        .onConflictDoUpdate({
          target: [tracks.source, tracks.identifier],
          set: {
            title,
            uri: track.info.uri ?? null,
            artworkUrl: track.info.artworkUrl ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({id: tracks.id});

      if (!savedTrack) {
        throw new Error('트랙 정보를 저장하지 못했어요.');
      }

      await tx
        .insert(monthlyTrackPlays)
          .values({
            guildId,
            userId: resolvedRequesterId,
            trackId: savedTrack.id,
            month,
            playCount: 1,
        })
        .onConflictDoUpdate({
          target: [monthlyTrackPlays.guildId, monthlyTrackPlays.userId, monthlyTrackPlays.trackId, monthlyTrackPlays.month],
          set: {
            playCount: sql`${monthlyTrackPlays.playCount} + 1`,
            updatedAt: new Date(),
          },
        });
    });
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(`월간 재생 기록 저장 중 오류가 발생했어요: ${error}`));
  }
}

export async function getMonthlyTrackRanking(guildId: string, month: Date): Promise<MonthlyTrackRankingRow[]> {
  const db = getDb();

  const playCount = sql<number>`sum(${monthlyTrackPlays.playCount})`.mapWith(Number);

  return await db
    .select({
      trackId: tracks.id,
      title: tracks.title,
      source: tracks.source,
      identifier: tracks.identifier,
      uri: tracks.uri,
      artworkUrl: tracks.artworkUrl,
      playCount: playCount.as('play_count'),
    })
    .from(monthlyTrackPlays)
    .innerJoin(tracks, eq(monthlyTrackPlays.trackId, tracks.id))
    .where(and(eq(monthlyTrackPlays.guildId, guildId), eq(monthlyTrackPlays.month, month)))
    .groupBy(tracks.id, tracks.title, tracks.source, tracks.identifier, tracks.uri, tracks.artworkUrl)
    .orderBy(desc(playCount), tracks.title)
    .limit(10);
}
