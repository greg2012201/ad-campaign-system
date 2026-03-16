import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { DataSource } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Cron, CronExpression } from "@nestjs/schedule";
import type Redis from "ioredis";
import type Redlock from "redlock";
import { OutboxEntity } from "./outbox.entity";
import { OUTBOX_REDIS_CLIENT, OUTBOX_REDLOCK } from "./redlock.provider";

const BATCH_SIZE = 10;
const LOCK_TTL_MS = 4000;
const LOCK_KEY = "locks:outbox-poll";

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
    } finally {
      await lock.release();
    }
  }

  private async processBatch() {
    await this.dataSource.transaction(async (manager) => {
      const entries: OutboxEntity[] = await manager.query(
        `
        SELECT * FROM outbox
        WHERE processed = false
        ORDER BY "createdAt" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        `,
        [BATCH_SIZE],
      );

      if (entries.length === 0) {
        return;
      }

      let processedCount = 0;

      for (const entry of entries) {
        try {
          switch (entry.eventType) {
            case "campaign_created":
              await this.templateBuildQueue.add(entry.eventType, entry.payload);
              break;
            case "template_ready":
              await this.publishQueue.add(entry.eventType, entry.payload);
              break;
            case "campaign_cancelled":
              await this.publishQueue.add(entry.eventType, entry.payload);
              break;
            default:
              this.logger.warn(
                `Unknown event type: ${entry.eventType} for outbox entry ${entry.id}`,
              );
              break;
          }

          await manager.query(
            `UPDATE outbox SET processed = true, "processedAt" = now() WHERE id = $1`,
            [entry.id],
          );

          processedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to process outbox entry ${entry.id}: ${error}`,
          );
        }
      }

      this.logger.log(
        `Processed ${processedCount}/${entries.length} outbox entries`,
      );
    });
  }
}
