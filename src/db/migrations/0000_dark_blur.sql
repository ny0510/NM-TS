CREATE TABLE "monthly_track_plays" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"track_id" integer NOT NULL,
	"month" date NOT NULL,
	"play_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"identifier" text NOT NULL,
	"title" text NOT NULL,
	"uri" text,
	"artwork_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monthly_track_plays" ADD CONSTRAINT "monthly_track_plays_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_track_plays_unique" ON "monthly_track_plays" USING btree ("guild_id","user_id","track_id","month");--> statement-breakpoint
CREATE INDEX "monthly_track_plays_guild_month_track_idx" ON "monthly_track_plays" USING btree ("guild_id","month","track_id");--> statement-breakpoint
CREATE INDEX "monthly_track_plays_guild_month_idx" ON "monthly_track_plays" USING btree ("guild_id","month");--> statement-breakpoint
CREATE INDEX "monthly_track_plays_user_idx" ON "monthly_track_plays" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_source_identifier_unique" ON "tracks" USING btree ("source","identifier");--> statement-breakpoint
CREATE INDEX "tracks_source_identifier_idx" ON "tracks" USING btree ("source","identifier");