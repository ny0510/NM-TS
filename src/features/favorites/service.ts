import {getDb} from '@/db';
import {tracks, userFavorites} from '@/db/schema';
import type {QueueTrack} from '@/types/music';
import {upsertTrack} from '@/db/trackUpsert';
import {extractTrackMeta} from '@/features/music/meta';
import {and, eq, inArray} from 'drizzle-orm';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';

const logger = new Logger('FavoritesService');

export interface FavoriteTrack {
  id: number;
  trackId: number;
  title: string;
  artist: string;
  uri: string | null;
  artworkUrl: string | null;
  durationMs: number;
  source: string;
  identifier: string;
  createdAt: Date;
}

export async function addFavorite(userId: string, track: QueueTrack): Promise<boolean> {
  const {source, identifier, title, artist, durationMs} = extractTrackMeta(track);

  if (!identifier || !title) {
    logger.warn(`트랙 메타데이터가 부족해 즐겨찾기 추가를 하지 않았어요. userId=${userId}`);
    return false;
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

      await tx.insert(userFavorites).values({
        userId,
        trackId: savedTrack.id,
      });
    });
    return true;
  } catch (error) {
    logger.error(toError(error, '즐겨찾기 추가 중 오류가 발생했어요'));
    return false;
  }
}

export async function removeFavorite(userId: string, trackId: number): Promise<boolean> {
  const db = getDb();

  try {
    await db.delete(userFavorites).where(and(eq(userFavorites.userId, userId), eq(userFavorites.trackId, trackId)));
    return true;
  } catch (error) {
    logger.error(toError(error, '즐겨찾기 제거 중 오류가 발생했어요'));
    return false;
  }
}

export async function getUserFavorites(userId: string): Promise<FavoriteTrack[]> {
  const db = getDb();

  try {
    const results = await db
      .select({
        id: userFavorites.id,
        trackId: userFavorites.trackId,
        title: tracks.title,
        artist: tracks.artist,
        uri: tracks.uri,
        artworkUrl: tracks.artworkUrl,
        durationMs: tracks.durationMs,
        source: tracks.source,
        identifier: tracks.identifier,
        createdAt: userFavorites.createdAt,
      })
      .from(userFavorites)
      .innerJoin(tracks, eq(userFavorites.trackId, tracks.id))
      .where(eq(userFavorites.userId, userId))
      .orderBy(userFavorites.createdAt);

    return results;
  } catch (error) {
    logger.error(toError(error, '즐겨찾기 목록 조회 중 오류가 발생했어요'));
    return [];
  }
}

export async function isFavorited(userId: string, source: string, identifier: string): Promise<boolean> {
  const db = getDb();

  try {
    const track = await db.select({id: tracks.id}).from(tracks).where(and(eq(tracks.source, source), eq(tracks.identifier, identifier))).limit(1);

    if (!track[0]) return false;

    const favorite = await db
      .select({id: userFavorites.id})
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.trackId, track[0].id)))
      .limit(1);

    return favorite.length > 0;
  } catch (error) {
    logger.error(toError(error, '즐겨찾기 확인 중 오류가 발생했어요'));
    return false;
  }
}

export async function clearFavorites(userId: string): Promise<number> {
  const db = getDb();

  try {
    const result = await db.delete(userFavorites).where(eq(userFavorites.userId, userId)).returning({id: userFavorites.id});
    return result.length;
  } catch (error) {
    logger.error(toError(error, '즐겨찾기 전체 제거 중 오류가 발생했어요'));
    return 0;
  }
}

export async function getFavoriteCount(userId: string): Promise<number> {
  const db = getDb();

  try {
    const result = await db.select({id: userFavorites.id}).from(userFavorites).where(eq(userFavorites.userId, userId));
    return result.length;
  } catch (error) {
    logger.error(toError(error, '즐겨찾기 수 확인 중 오류가 발생했어요'));
    return 0;
  }
}

export async function getFavoritesByTrackIds(userId: string, trackIds: number[]): Promise<Map<number, boolean>> {
  if (trackIds.length === 0) return new Map();

  const db = getDb();

  try {
    const favorites = await db
      .select({trackId: userFavorites.trackId})
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), inArray(userFavorites.trackId, trackIds)));

    const map = new Map<number, boolean>();
    for (const trackId of trackIds) {
      map.set(trackId, favorites.some(f => f.trackId === trackId));
    }
    return map;
  } catch (error) {
    logger.error(toError(error, '즐겨찾기 확인 중 오류가 발생했어요'));
    return new Map();
  }
}