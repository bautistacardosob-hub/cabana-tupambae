CREATE TABLE "animal_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"animal_id" integer NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text,
	"external_url" text,
	"filename" text,
	"content_type" text,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rp" text NOT NULL,
	"breed" text DEFAULT 'Aberdeen Angus' NOT NULL,
	"birth_date" text,
	"coat" text,
	"registration" text,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"image" text DEFAULT '/animal-black.jpg' NOT NULL,
	"birth_weight" text,
	"weaning_weight" text,
	"scrotal_circumference" text,
	"frame" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"title" text NOT NULL,
	"auction_date" text,
	"location" text,
	"lots" text,
	"description" text,
	"catalog_url" text,
	"stream_url" text,
	"image" text DEFAULT '/ranch.jpg' NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cabins" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_name" text,
	"owner_email" text,
	"domain" text,
	"site_url" text,
	"admin_url" text,
	"status" text DEFAULT 'setup' NOT NULL,
	"modules" text DEFAULT '[]' NOT NULL,
	"primary_color" text DEFAULT '#6c422b' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text,
	"content_type" text,
	"caption" text,
	"category" text,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genetic_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"animal_id" integer NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"precision" text,
	"percentile" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text,
	"video_url" text,
	"category" text DEFAULT 'Actualidad' NOT NULL,
	"image" text DEFAULT '/ranch.jpg' NOT NULL,
	"storage_key" text,
	"article_image" text,
	"article_storage_key" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedigree_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"animal_id" integer NOT NULL,
	"relation" text NOT NULL,
	"name" text NOT NULL,
	"registration" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"content_key" text NOT NULL,
	"value" text NOT NULL,
	"draft_value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"image_key" text NOT NULL,
	"label" text NOT NULL,
	"storage_key" text,
	"draft_storage_key" text,
	"fallback_url" text NOT NULL,
	"content_type" text,
	"draft_content_type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"cabin_id" integer NOT NULL,
	"snapshot" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"cabin_id" integer NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animal_categories" ADD CONSTRAINT "animal_categories_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_media" ADD CONSTRAINT "animal_media_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_categories" ADD CONSTRAINT "gallery_categories_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_media" ADD CONSTRAINT "gallery_media_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genetic_data" ADD CONSTRAINT "genetic_data_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedigree_members" ADD CONSTRAINT "pedigree_members_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_images" ADD CONSTRAINT "site_images_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_publications" ADD CONSTRAINT "site_publications_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_cabin_id_cabins_id_fk" FOREIGN KEY ("cabin_id") REFERENCES "public"."cabins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_animal_categories_cabin_slug" ON "animal_categories" USING btree ("cabin_id","slug");--> statement-breakpoint
CREATE INDEX "idx_animal_media_animal_sort" ON "animal_media" USING btree ("animal_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_animals_cabin_rp" ON "animals" USING btree ("cabin_id","rp");--> statement-breakpoint
CREATE INDEX "idx_animals_cabin_status" ON "animals" USING btree ("cabin_id","status");--> statement-breakpoint
CREATE INDEX "idx_animals_updated_at" ON "animals" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_auctions_cabin_status_date" ON "auctions" USING btree ("cabin_id","status","auction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cabins_slug" ON "cabins" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_client_sites_slug" ON "client_sites" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_client_sites_status" ON "client_sites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contact_messages_cabin_read_created" ON "contact_messages" USING btree ("cabin_id","is_read","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gallery_categories_cabin_slug" ON "gallery_categories" USING btree ("cabin_id","slug");--> statement-breakpoint
CREATE INDEX "idx_gallery_media_cabin_published_sort" ON "gallery_media" USING btree ("cabin_id","published","sort_order");--> statement-breakpoint
CREATE INDEX "idx_genetic_data_animal_sort" ON "genetic_data" USING btree ("animal_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_news_posts_cabin_slug" ON "news_posts" USING btree ("cabin_id","slug");--> statement-breakpoint
CREATE INDEX "idx_news_posts_cabin_published_date" ON "news_posts" USING btree ("cabin_id","published","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pedigree_animal_relation" ON "pedigree_members" USING btree ("animal_id","relation");--> statement-breakpoint
CREATE INDEX "idx_pedigree_animal_sort" ON "pedigree_members" USING btree ("animal_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_site_content_cabin_key" ON "site_content" USING btree ("cabin_id","content_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_site_images_cabin_key" ON "site_images" USING btree ("cabin_id","image_key");--> statement-breakpoint
CREATE INDEX "idx_site_publications_cabin_date" ON "site_publications" USING btree ("cabin_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_roles_user_cabin" ON "user_roles" USING btree ("user_id","cabin_id");