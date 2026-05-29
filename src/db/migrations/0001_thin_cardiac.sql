DROP INDEX "track_play_events_guild_month_idx";--> statement-breakpoint
DROP INDEX "track_play_events_user_month_idx";--> statement-breakpoint
ALTER TABLE "track_play_events" DROP COLUMN "month";