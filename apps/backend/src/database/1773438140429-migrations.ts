import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1773438140429 implements MigrationInterface {
    name = 'Migrations1773438140429'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "aggregateType" text NOT NULL, "aggregateId" uuid NOT NULL, "eventType" text NOT NULL, "payload" jsonb NOT NULL, "processed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "processedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_340ab539f309f03bdaa14aa7649" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_18710e7128c96d375850052ca1" ON "outbox" ("processed", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."devices_status_enum" AS ENUM('online', 'offline')`);
        await queryRunner.query(`CREATE TABLE "devices" ("deviceId" text NOT NULL, "groupId" text, "lastSeen" TIMESTAMP WITH TIME ZONE, "status" "public"."devices_status_enum" NOT NULL DEFAULT 'offline', "metadata" jsonb, CONSTRAINT "PK_666c9b59efda8ca85b29157152c" PRIMARY KEY ("deviceId"))`);
        await queryRunner.query(`CREATE TYPE "public"."campaign_assets_assettype_enum" AS ENUM('image', 'video', 'html')`);
        await queryRunner.query(`CREATE TABLE "campaign_assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaignId" uuid NOT NULL, "assetType" "public"."campaign_assets_assettype_enum" NOT NULL, "url" text NOT NULL, "checksum" text, "durationMs" integer, "sizeBytes" bigint, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0e5baaf5fcbc2c81ffd922061e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."delivery_events_eventtype_enum" AS ENUM('install_ack', 'display_start', 'display_complete', 'error')`);
        await queryRunner.query(`CREATE TABLE "delivery_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "deviceId" text NOT NULL, "campaignId" uuid NOT NULL, "version" integer NOT NULL, "eventType" "public"."delivery_events_eventtype_enum" NOT NULL, "assetId" uuid, "payload" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2c17d18150759fe457c2b1945bd" UNIQUE ("eventId"), CONSTRAINT "PK_19b3537a3e016d72733fa56f7a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_645df7ce73fc2bc88eb0b3125a" ON "delivery_events" ("deviceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b48def6b22a645ddc55412ead" ON "delivery_events" ("campaignId") `);
        await queryRunner.query(`CREATE TYPE "public"."campaigns_status_enum" AS ENUM('draft', 'building', 'ready', 'publishing', 'active', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "version" integer NOT NULL DEFAULT '1', "startAt" bigint NOT NULL, "expireAt" bigint NOT NULL, "metadata" jsonb, "status" "public"."campaigns_status_enum" NOT NULL DEFAULT 'draft', "createdBy" text, "idempotencyKey" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4b017933c6aaacf077a2dcd2e30" UNIQUE ("idempotencyKey"), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_319f7c6d15f206ccc50355b824" ON "campaigns" ("startAt") `);
        await queryRunner.query(`ALTER TABLE "campaign_assets" ADD CONSTRAINT "FK_632ad707151053aac051dbce984" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_events" ADD CONSTRAINT "FK_645df7ce73fc2bc88eb0b3125a0" FOREIGN KEY ("deviceId") REFERENCES "devices"("deviceId") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_events" ADD CONSTRAINT "FK_5b48def6b22a645ddc55412eadd" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_events" DROP CONSTRAINT "FK_5b48def6b22a645ddc55412eadd"`);
        await queryRunner.query(`ALTER TABLE "delivery_events" DROP CONSTRAINT "FK_645df7ce73fc2bc88eb0b3125a0"`);
        await queryRunner.query(`ALTER TABLE "campaign_assets" DROP CONSTRAINT "FK_632ad707151053aac051dbce984"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_319f7c6d15f206ccc50355b824"`);
        await queryRunner.query(`DROP TABLE "campaigns"`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5b48def6b22a645ddc55412ead"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_645df7ce73fc2bc88eb0b3125a"`);
        await queryRunner.query(`DROP TABLE "delivery_events"`);
        await queryRunner.query(`DROP TYPE "public"."delivery_events_eventtype_enum"`);
        await queryRunner.query(`DROP TABLE "campaign_assets"`);
        await queryRunner.query(`DROP TYPE "public"."campaign_assets_assettype_enum"`);
        await queryRunner.query(`DROP TABLE "devices"`);
        await queryRunner.query(`DROP TYPE "public"."devices_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18710e7128c96d375850052ca1"`);
        await queryRunner.query(`DROP TABLE "outbox"`);
    }

}
