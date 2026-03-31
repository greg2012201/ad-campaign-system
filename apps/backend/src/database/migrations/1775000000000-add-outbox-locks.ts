import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxLocks1775000000000 implements MigrationInterface {
  name = 'AddOutboxLocks1775000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "outbox" ADD COLUMN "lockedBy" text`);
    await queryRunner.query(`ALTER TABLE "outbox" ADD COLUMN "lockedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE INDEX "IDX_outbox_locked" ON "outbox" ("processed", "lockedAt", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_locked"`);
    await queryRunner.query(`ALTER TABLE "outbox" DROP COLUMN "lockedAt"`);
    await queryRunner.query(`ALTER TABLE "outbox" DROP COLUMN "lockedBy"`);
  }
}
