import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1777000000000 implements MigrationInterface {
  name = "InitialSchema1777000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_status_enum" AS ENUM('draft', 'building', 'ready', 'publishing', 'active', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "start_at" bigint NOT NULL,
        "expire_at" bigint NOT NULL,
        "metadata" jsonb,
        "status" "public"."campaigns_status_enum" NOT NULL DEFAULT 'draft',
        "created_by" text,
        "idempotency_key" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_campaigns_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "PK_campaigns" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaigns_start_at" ON "campaigns" ("start_at")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."campaign_assets_asset_type_enum" AS ENUM('image', 'video', 'html')`,
    );
    await queryRunner.query(
      `CREATE TABLE "campaign_assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "asset_type" "public"."campaign_assets_asset_type_enum" NOT NULL,
        "url" text NOT NULL,
        "checksum" text,
        "duration_ms" integer,
        "size_bytes" bigint,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_assets" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."devices_status_enum" AS ENUM('online', 'offline')`,
    );
    await queryRunner.query(
      `CREATE TABLE "devices" (
        "device_id" text NOT NULL,
        "group_id" text,
        "last_seen" TIMESTAMP WITH TIME ZONE,
        "status" "public"."devices_status_enum" NOT NULL DEFAULT 'offline',
        "metadata" jsonb,
        CONSTRAINT "PK_devices" PRIMARY KEY ("device_id")
      )`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."delivery_events_event_type_enum" AS ENUM('install_ack', 'display_start', 'display_complete', 'revoke_ack', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "device_id" text NOT NULL,
        "campaign_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "event_type" "public"."delivery_events_event_type_enum" NOT NULL,
        "asset_id" uuid,
        "payload" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_delivery_events_event_id" UNIQUE ("event_id"),
        CONSTRAINT "PK_delivery_events" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_events_device_id" ON "delivery_events" ("device_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_events_campaign_id" ON "delivery_events" ("campaign_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_events_campaign_version_event_type" ON "delivery_events" ("campaign_id", "version", "event_type") INCLUDE ("device_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "outbox" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "aggregate_type" text NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "event_type" text NOT NULL,
        "payload" jsonb NOT NULL,
        "processed" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "locked_by" text,
        "locked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_outbox" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_processed_locked_at_created_at" ON "outbox" ("processed", "locked_at", "created_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "campaign_assets" ADD CONSTRAINT "FK_campaign_assets_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_events" ADD CONSTRAINT "FK_delivery_events_device" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_events" ADD CONSTRAINT "FK_delivery_events_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "delivery_events" DROP CONSTRAINT "FK_delivery_events_campaign"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_events" DROP CONSTRAINT "FK_delivery_events_device"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_assets" DROP CONSTRAINT "FK_campaign_assets_campaign"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_outbox_processed_locked_at_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "outbox"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_delivery_events_campaign_version_event_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_delivery_events_campaign_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_delivery_events_device_id"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_events"`);
    await queryRunner.query(
      `DROP TYPE "public"."delivery_events_event_type_enum"`,
    );

    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP TYPE "public"."devices_status_enum"`);

    await queryRunner.query(`DROP TABLE "campaign_assets"`);
    await queryRunner.query(
      `DROP TYPE "public"."campaign_assets_asset_type_enum"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_campaigns_start_at"`,
    );
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
  }
}
