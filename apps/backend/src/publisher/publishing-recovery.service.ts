import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DataSource, LessThan } from "typeorm";
import {
  CampaignEntity,
  CampaignStatusEnum,
} from "../campaigns/campaign.entity";

const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

@Injectable()
export class PublishingRecoveryService {
  private readonly logger = new Logger(PublishingRecoveryService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue("publish")
    private readonly publishQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async recoverStuckCampaigns() {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

    const stuckCampaigns = await this.dataSource
      .getRepository(CampaignEntity)
      .find({
        where: {
          status: CampaignStatusEnum.PUBLISHING,
          updatedAt: LessThan(threshold),
        },
      });

    for (const campaign of stuckCampaigns) {
      this.logger.warn(
        `Recovering stuck campaign ${campaign.id} (updated at ${campaign.updatedAt.toISOString()})`,
      );

      try {
        const resetResult = await this.dataSource
          .getRepository(CampaignEntity)
          .createQueryBuilder()
          .update(CampaignEntity)
          .set({ status: CampaignStatusEnum.READY })
          .where("id = :id AND status = :expected", {
            id: campaign.id,
            expected: CampaignStatusEnum.PUBLISHING,
          })
          .execute();

        if (resetResult.affected === 0) {
          this.logger.warn(
            `Campaign ${campaign.id} status changed since query, skipping recovery`,
          );
          continue;
        }

        await this.publishQueue.add(
          "template_ready",
          { campaignId: campaign.id },
          { jobId: `recover-${campaign.id}` },
        );
      } catch (e) {
        this.logger.error(
          `Failed to enqueue recovery job for campaign ${campaign.id}: ${e}`,
        );
      }
    }

    if (stuckCampaigns.length > 0) {
      this.logger.log(
        `Recovery check complete: ${stuckCampaigns.length} stuck campaign(s) re-enqueued`,
      );
    }
  }
}
