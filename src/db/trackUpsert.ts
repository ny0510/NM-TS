import {tracks} from '@/db/schema';
import type {PostgresJsTransaction} from 'drizzle-orm/postgres-js';

export interface UpsertTrackData {
  source: string;
  identifier: string;
  title: string;
  artist: string;
  durationMs: number;
  uri: string | null;
  artworkUrl: string | null;
}

export async function upsertTrack(
  tx: PostgresJsTransaction<any, any>,
  data: UpsertTrackData,
): Promise<{id: number}> {
  const [savedTrack] = await tx
    .insert(tracks)
    .values({
      source: data.source,
      identifier: data.identifier,
      title: data.title,
      artist: data.artist,
      durationMs: data.durationMs,
      uri: data.uri,
      artworkUrl: data.artworkUrl,
    })
    .onConflictDoUpdate({
      target: [tracks.source, tracks.identifier],
      set: {
        title: data.title,
        artist: data.artist,
        durationMs: data.durationMs,
        uri: data.uri,
        artworkUrl: data.artworkUrl,
        updatedAt: new Date(),
      },
    })
    .returning({id: tracks.id});

  if (!savedTrack) {
    throw new Error('트랙 정보를 저장하지 못했어요.');
  }

  return savedTrack;
}
