CREATE TABLE "player_states" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_play_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"track_id" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_autoplay" boolean DEFAULT false NOT NULL,
	"ended_reason" text NOT NULL,
	"request_channel_id" text,
	"play_context" text NOT NULL,
	"queue_type" text NOT NULL,
	"month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"identifier" text NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"uri" text,
	"artwork_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_play_events" ADD CONSTRAINT "track_play_events_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_play_events_guild_played_at_idx" ON "track_play_events" USING btree ("guild_id","played_at");--> statement-breakpoint
CREATE INDEX "track_play_events_guild_user_played_at_idx" ON "track_play_events" USING btree ("guild_id","user_id","played_at");--> statement-breakpoint
CREATE INDEX "track_play_events_guild_track_played_at_idx" ON "track_play_events" USING btree ("guild_id","track_id","played_at");--> statement-breakpoint
CREATE INDEX "track_play_events_user_played_at_idx" ON "track_play_events" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE INDEX "track_play_events_guild_month_idx" ON "track_play_events" USING btree ("guild_id","month");--> statement-breakpoint
CREATE INDEX "track_play_events_user_month_idx" ON "track_play_events" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_source_identifier_unique" ON "tracks" USING btree ("source","identifier");--> statement-breakpoint
CREATE INDEX "tracks_source_identifier_idx" ON "tracks" USING btree ("source","identifier");