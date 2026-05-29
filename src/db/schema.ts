import {date, index, integer, pgTable, serial, text, timestamp, uniqueIndex} from 'drizzle-orm/pg-core';

export const tracks = pgTable(
  'tracks',
  {
    id: serial('id').primaryKey(),
    source: text('source').notNull(),
    identifier: text('identifier').notNull(),
    title: text('title').notNull(),
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

export const monthlyTrackPlays = pgTable(
  'monthly_track_plays',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    trackId: integer('track_id')
      .notNull()
      .references(() => tracks.id, {onDelete: 'cascade'}),
    month: date('month', {mode: 'date'}).notNull(),
    playCount: integer('play_count').notNull().default(1),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('monthly_track_plays_unique').on(table.guildId, table.userId, table.trackId, table.month),
    index('monthly_track_plays_guild_month_track_idx').on(table.guildId, table.month, table.trackId),
    index('monthly_track_plays_guild_month_idx').on(table.guildId, table.month),
    index('monthly_track_plays_user_idx').on(table.userId),
  ],
);
