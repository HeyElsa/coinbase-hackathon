CREATE TABLE IF NOT EXISTS "BackgroundTask" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"type" varchar NOT NULL,
	"payload" text,
	"userId" uuid NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"log" varchar
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BackgroundTask" ADD CONSTRAINT "BackgroundTask_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
