import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeliveryEventsCoveringIndex1776000000000 implements MigrationInterface {
  name = "AddDeliveryEventsCoveringIndex1776000000000";

  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_delivery_events_campaign_version_eventtype_covering"
      ON "delivery_events" ("campaignId", "version", "eventType")
      INCLUDE ("deviceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX CONCURRENTLY IF EXISTS "IDX_delivery_events_campaign_version_eventtype_covering"
    `);
  }
}
