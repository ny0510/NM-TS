import {boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex} from 'drizzle-orm/pg-core';

import type {PersistedQueueState} from '@/types/playerState';

export const tracks = pgTable(
  'tracks',
  {
    id: serial('id').primaryKey(),
    source: text('source').notNull(),
    identifier: text('identifier').notNull(),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    durationMs: integer('duration_ms').notNull(),
    uri: text('uri'),
    artworkUrl: text('artwork_url'),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('tracks_source_identifier_unique').on(table.source, table.identifier),
    index('tracks_source_identifier_idx').on(table.source, table.identifier),
  ],
);

export const trackPlayEvents = pgTable(
  'track_play_events',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    trackId: integer('track_id')
      .notNull()
      .references(() => tracks.id, {onDelete: 'cascade'}),
    playedAt: timestamp('played_at', {withTimezone: true}).defaultNow().notNull(),
    isAutoplay: boolean('is_autoplay').notNull().default(false),
    endedReason: text('ended_reason').notNull(),
    requestChannelId: text('request_channel_id'),
    playContext: text('play_context').notNull(),
    queueType: text('queue_type').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  table => [
    index('track_play_events_guild_played_at_idx').on(table.guildId, table.playedAt),
    index('track_play_events_guild_user_played_at_idx').on(table.guildId, table.userId, table.playedAt),
    index('track_play_events_guild_track_played_at_idx').on(table.guildId, table.trackId, table.playedAt),
    index('track_play_events_user_played_at_idx').on(table.userId, table.playedAt),
  ],
);

export const playerStates = pgTable('player_states', {
  guildId: text('guild_id').primaryKey(),
  version: integer('version').notNull(),
  state: jsonb('state').$type<PersistedQueueState>().notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
});

export const userFavorites = pgTable(
  'user_favorites',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    trackId: integer('track_id')
      .notNull()
      .references(() => tracks.id, {onDelete: 'cascade'}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('user_favorites_user_track_unique').on(table.userId, table.trackId),
    index('user_favorites_user_idx').on(table.userId),
  ],
);
