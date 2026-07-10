import {and, count, desc, eq, gte, lt} from 'drizzle-orm';
import {DateTime} from 'luxon';

import {getDb} from '@/db';
import {trackPlayEvents, tracks} from '@/db/schema';

const KST_ZONE = 'Asia/Seoul';
const CHART_LIMIT = 50;

export interface ChartRankingRow {
  rank: number;
  trackId: number;
  title: string;
  artist: string;
  uri: string | null;
  artworkUrl: string | null;
  playCount: number;
  rankChange: number | null;
}

function getMonthRanges(month: Date): {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const dt = DateTime.fromJSDate(month, {zone: KST_ZONE}).startOf('month');
  const currentStart = dt.toJSDate();
  const currentEnd = dt.plus({months: 1}).toJSDate();
  const prevStart = dt.minus({months: 1}).toJSDate();
  const prevEnd = currentStart;
  return {currentStart, currentEnd, prevStart, prevEnd};
}

export function getCurrentMonthStart(): Date {
  return DateTime.now().setZone(KST_ZONE).startOf('month').toJSDate();
}

export function parseMonthInput(value: string): Date | null {
  const parsed = DateTime.fromFormat(value.trim(), 'yyyy-MM', {zone: KST_ZONE}).startOf('month');
  return parsed.isValid ? parsed.toJSDate() : null;
}

export function formatMonthLabel(month: Date): string {
  return DateTime.fromJSDate(month, {zone: KST_ZONE}).toFormat('yyyy년 M월');
}

async function getRanking(
  month: Date,
  guildId: string | null,
): Promise<{trackId: number; title: string; artist: string; uri: string | null; artworkUrl: string | null; playCount: number}[]> {
  const db = getDb();
  const {currentStart, currentEnd} = getMonthRanges(month);
  const playCount = count().mapWith(Number);

  const conditions = [
    gte(trackPlayEvents.playedAt, currentStart),
    lt(trackPlayEvents.playedAt, currentEnd),
  ];
  if (guildId) {
    conditions.push(eq(trackPlayEvents.guildId, guildId));
  }

  return await db
    .select({
      trackId: tracks.id,
      title: tracks.title,
      artist: tracks.artist,
      uri: tracks.uri,
      artworkUrl: tracks.artworkUrl,
      playCount: playCount.as('play_count'),
    })
    .from(trackPlayEvents)
    .innerJoin(tracks, eq(trackPlayEvents.trackId, tracks.id))
    .where(and(...conditions))
    .groupBy(tracks.id, tracks.title, tracks.artist, tracks.uri, tracks.artworkUrl)
    .orderBy(desc(playCount), tracks.title)
    .limit(CHART_LIMIT);
}

async function getPrevRankMap(month: Date, guildId: string | null): Promise<Map<number, number>> {
  const db = getDb();
  const {prevStart, prevEnd} = getMonthRanges(month);
  const playCount = count().mapWith(Number);

  const conditions = [
    gte(trackPlayEvents.playedAt, prevStart),
    lt(trackPlayEvents.playedAt, prevEnd),
  ];
  if (guildId) {
    conditions.push(eq(trackPlayEvents.guildId, guildId));
  }

  const prevRows = await db
    .select({
      trackId: tracks.id,
      playCount: playCount.as('play_count'),
    })
    .from(trackPlayEvents)
    .innerJoin(tracks, eq(trackPlayEvents.trackId, tracks.id))
    .where(and(...conditions))
    .groupBy(tracks.id)
    .orderBy(desc(playCount))
    .limit(CHART_LIMIT);

  const map = new Map<number, number>();
  prevRows.forEach((row, index) => {
    map.set(row.trackId, index + 1);
  });
  return map;
}

export async function getChartRanking(month: Date, guildId: string | null): Promise<ChartRankingRow[]> {
  const [currentRanking, prevRankMap] = await Promise.all([getRanking(month, guildId), getPrevRankMap(month, guildId)]);

  return currentRanking.map((row, index) => {
    const currentRank = index + 1;
    const prevRank = prevRankMap.get(row.trackId) ?? null;

    let rankChange: number | null = null;
    if (prevRank !== null) {
      rankChange = prevRank - currentRank;
    }

    return {
      rank: currentRank,
      ...row,
      rankChange,
    };
  });
}

export function getTotalPlayCount(ranking: ChartRankingRow[]): number {
  return ranking.reduce((sum, row) => sum + row.playCount, 0);
}
