import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { TOPICS } from "@campaign-system/shared";
import {
  CampaignEntity,
  CampaignStatusEnum,
} from "../campaigns/campaign.entity";
import { MqttProvider } from "./mqtt.provider";
import { DeviceStreamService } from "./device-stream.service";
import { DevicePublishTracker } from "./device-publish-tracker";
import { buildManifest } from "./build-manifest";

const BATCH_SIZE = 200;

@Injectable()
@Processor("publish")
export class PublisherProcessor extends WorkerHost {
  private readonly logger = new Logger(PublisherProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mqttProvider: MqttProvider,
    private readonly deviceStreamService: DeviceStreamService,
    private readonly devicePublishTracker: DevicePublishTracker,
    @InjectQueue("verify-delivery")
    private readonly verifyDeliveryQueue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name === "campaign_cancelled") {
      return this.handleCancel(job);
    }

    return this.handlePublish(job);
  }

  private async handlePublish(job: Job) {
    const { campaignId } = job.data;

    const campaign = await this.dataSource
      .getRepository(CampaignEntity)
      .findOne({
        where: { id: campaignId },
        relations: ["assets"],
      });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const startResult = await this.dataSource
      .getRepository(CampaignEntity)
      .createQueryBuilder()
      .update(CampaignEntity)
      .set({ status: CampaignStatusEnum.PUBLISHING })
      .where("id = :id AND status = :expected", {
        id: campaignId,
        expected: CampaignStatusEnum.READY,
      })
      .execute();

    if (startResult.affected === 0) {
      this.logger.warn(
        `Campaign ${campaignId} is no longer in READY state, skipping publish`,
      );
      return;
    }

    const apiBaseUrl = this.configService.get(
      "API_BASE_URL",
      "http://localhost:3000",
    );
    const manifest = buildManifest({ campaign, apiBaseUrl });
    const payload = JSON.stringify(manifest);

    const alreadyPublished = await this.devicePublishTracker.getPublished({
      campaignId: campaign.id,
      version: campaign.version,
    });

    let successCount = 0;
    let failureCount = 0;

    for await (const batch of this.deviceStreamService.streamBatches({
      batchSize: BATCH_SIZE,
      excludeDeviceIds: alreadyPublished,
    })) {
      const results = await Promise.allSettled(
        batch.map((device) =>
          this.mqttProvider.publishWithTimeout({
            topic: TOPICS.NOTIFICATIONS(device.deviceId),
            payload,
            qos: 1,
          }),
        ),
      );

      const publishedIds: string[] = [];

      results.forEach((result, j) => {
        if (result.status === "fulfilled") {
          successCount++;
          publishedIds.push(batch[j]!.deviceId);
        } else {
          failureCount++;
          this.logger.error(
            `Failed to publish to device ${batch[j]?.deviceId}: ${result.reason}`,
          );
        }
      });

      await this.devicePublishTracker.markPublished({
        campaignId: campaign.id,
        version: campaign.version,
        deviceIds: publishedIds,
      });
    }

    await this.verifyDeliveryQueue.add(
      "verify-delivery",
      { campaignId: campaign.id, version: campaign.version },
      {
        delay: 30000,
        jobId: `verify-${campaign.id}-v${campaign.version}-a1`,
      },
    );

    const finalResult = await this.dataSource
      .getRepository(CampaignEntity)
      .createQueryBuilder()
      .update(CampaignEntity)
      .set({ status: CampaignStatusEnum.ACTIVE })
      .where("id = :id AND status = :expected", {
        id: campaignId,
        expected: CampaignStatusEnum.PUBLISHING,
      })
      .execute();

    if (finalResult.affected === 0) {
      this.logger.warn(
        `Campaign ${campaignId} was modified during publishing (likely cancelled), not marking as ACTIVE`,
      );
    }

    this.logger.log(
      `Campaign ${campaignId} published — success: ${successCount}, failed: ${failureCount}, skipped: ${alreadyPublished.size}`,
    );
  }

  private async handleCancel(job: Job) {
    const { campaignId } = job.data;

    const campaign = await this.dataSource
      .getRepository(CampaignEntity)
      .findOne({ where: { id: campaignId } });

    if (!campaign || campaign.status !== CampaignStatusEnum.CANCELLED) {
      this.logger.warn(
        `Campaign ${campaignId} is not in CANCELLED state, skipping revoke`,
      );
      return;
    }

    const payload = JSON.stringify({ type: "revoke", campaignId });

    const alreadyRevoked = await this.devicePublishTracker.getRevoked({
      campaignId,
    });

    let successCount = 0;
    let failureCount = 0;

    for await (const batch of this.deviceStreamService.streamBatches({
      batchSize: BATCH_SIZE,
      excludeDeviceIds: alreadyRevoked,
    })) {
      const results = await Promise.allSettled(
        batch.map((device) =>
          this.mqttProvider.publishWithTimeout({
            topic: TOPICS.CONTROL(device.deviceId),
            payload,
            qos: 1,
          }),
        ),
      );

      const revokedIds: string[] = [];

      results.forEach((result, j) => {
        if (result.status === "fulfilled") {
          successCount++;
          revokedIds.push(batch[j]!.deviceId);
        } else {
          failureCount++;
          this.logger.error(
            `Failed to send revoke to device ${batch[j]?.deviceId}: ${result.reason}`,
          );
        }
      });

      await this.devicePublishTracker.markRevoked({
        campaignId,
        deviceIds: revokedIds,
      });
    }

    await this.verifyDeliveryQueue.add(
      "verify-revoke",
      { campaignId, attempt: 1 },
      {
        delay: 30000,
        jobId: `verify-revoke-${campaignId}-a1`,
      },
    );

    this.logger.log(
      `Campaign ${campaignId} revoke sent — success: ${successCount}, failed: ${failureCount}, skipped: ${alreadyRevoked.size}`,
    );
  }
}
