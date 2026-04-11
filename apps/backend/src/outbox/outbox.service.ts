import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { DataSource } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Cron, CronExpression } from "@nestjs/schedule";
import type Redis from "ioredis";
import type Redlock from "redlock";
import { v4 as uuidv4 } from "uuid";
import { OUTBOX_REDIS_CLIENT, OUTBOX_REDLOCK } from "./redlock.provider";

type OutboxRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
};

const BATCH_SIZE = 10;
const LOCK_TTL_MS = 4000;
const LOCK_KEY = "locks:outbox-poll";
const CLAIM_TTL_MINUTES = 10;

@Injectable()
export class OutboxService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectQueue("template-build")
    private readonly templateBuildQueue: Queue,
    @InjectQueue("publish")
    private readonly publishQueue: Queue,
    @Inject(OUTBOX_REDIS_CLIENT)
    private readonly redisClient: Redis,
    @Inject(OUTBOX_REDLOCK)
    private readonly redlock: Redlock,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleDestroy() {
    this.redisClient.disconnect();
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    let lock;

    try {
      lock = await this.redlock.acquire([LOCK_KEY], LOCK_TTL_MS);
    } catch {
      return;
    }

    try {
      await this.processBatch();
      await this.cleanupStaleClaims();
    } finally {
      await lock.release();
    }
  }

  private async processBatch() {
    const workerId = uuidv4();

    const entries: OutboxRow[] = await this.dataSource.transaction(
      async (manager) => {
        const rows: OutboxRow[] = await manager.query(
          `
        SELECT * FROM outbox
        WHERE processed = false
          AND ("locked_by" IS NULL OR "locked_at" < now() - INTERVAL '${CLAIM_TTL_MINUTES} minutes')
        ORDER BY "created_at" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        `,
          [BATCH_SIZE],
        );

        if (rows.length === 0) return [];

        const ids = rows.map((r) => r.id);
        await manager.query(
          `UPDATE outbox SET "locked_by" = $1, "locked_at" = now() WHERE id = ANY($2::uuid[]) AND processed = false`,
          [workerId, ids],
        );

        return rows;
      },
    );

    if (entries.length === 0) return;

    let processedCount = 0;

    for (const entry of entries) {
      try {
        const jobOpts = { jobId: `outbox-${entry.id}` };

        switch (entry.event_type) {
          case "campaign_created":
            await this.templateBuildQueue.add(
              entry.event_type,
              entry.payload,
              jobOpts,
            );
            break;
          case "template_ready":
            await this.publishQueue.add(
              entry.event_type,
              entry.payload,
              jobOpts,
            );
            break;
          case "campaign_cancelled":
            await this.publishQueue.add(
              entry.event_type,
              entry.payload,
              jobOpts,
            );
            break;
          default:
            this.logger.warn(
              `Unknown event type: ${entry.event_type} for outbox entry ${entry.id}`,
            );
            break;
        }

        await this.dataSource.query(
          `UPDATE outbox SET processed = true, "processed_at" = now(), "locked_by" = NULL, "locked_at" = NULL WHERE id = $1 AND "locked_by" = $2`,
          [entry.id, workerId],
        );

        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to publish outbox entry ${entry.id}: ${error}`,
        );

        try {
          await this.dataSource.query(
            `UPDATE outbox SET "locked_by" = NULL, "locked_at" = NULL WHERE id = $1 AND "locked_by" = $2`,
            [entry.id, workerId],
          );
        } catch (e) {
          this.logger.error(
            `Failed to clear lock for outbox ${entry.id}: ${e}`,
          );
        }
      }
    }

    this.logger.log(
      `Processed ${processedCount}/${entries.length} outbox entries`,
    );
  }

  private async cleanupStaleClaims() {
    try {
      await this.dataSource.query(
        `UPDATE outbox SET "locked_by" = NULL, "locked_at" = NULL WHERE processed = false AND "locked_at" < now() - INTERVAL '${CLAIM_TTL_MINUTES} minutes'`,
      );
    } catch (error) {
      this.logger.error(`Failed to cleanup stale outbox claims: ${error}`);
    }
  }
}
