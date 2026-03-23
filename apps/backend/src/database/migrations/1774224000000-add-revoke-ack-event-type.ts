import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRevokeAckEventType1774224000000 implements MigrationInterface {
    name = 'AddRevokeAckEventType1774224000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."delivery_events_eventtype_enum" ADD VALUE IF NOT EXISTS 'revoke_ack'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."delivery_events_eventtype_enum_old" AS ENUM('install_ack', 'display_start', 'display_complete', 'error')`);
        await queryRunner.query(`ALTER TABLE "delivery_events" ALTER COLUMN "eventType" TYPE "public"."delivery_events_eventtype_enum_old" USING "eventType"::"text"::"public"."delivery_events_eventtype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."delivery_events_eventtype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."delivery_events_eventtype_enum_old" RENAME TO "delivery_events_eventtype_enum"`);
    }

}
