CREATE TYPE "public"."material_status" AS ENUM('Active', 'Obsolete', 'Pending Review');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('Spare Part', 'Consumable', 'Raw Material', 'Tool');--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_number" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"material_type" "material_type" NOT NULL,
	"manufacturer" text NOT NULL,
	"manufacturer_part_number" text NOT NULL,
	"plant_id" integer NOT NULL,
	"status" "material_status" DEFAULT 'Active' NOT NULL,
	"unit_of_measure" varchar(3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_material_number_unique" UNIQUE("material_number")
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(4) NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "plants_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "materials_plant_id_idx" ON "materials" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "materials_status_idx" ON "materials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "materials_material_type_idx" ON "materials" USING btree ("material_type");--> statement-breakpoint
CREATE INDEX "materials_updated_at_idx" ON "materials" USING btree ("updated_at");