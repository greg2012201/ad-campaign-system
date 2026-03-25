import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import { TOPICS } from "@campaign-system/shared";
import type { Manifest } from "@campaign-system/shared";
import {
  CampaignEntity,
  CampaignStatusEnum,
} from "../campaigns/campaign.entity";
import { DeviceEntity } from "../devices/device.entity";
import { MqttProvider } from "./mqtt.provider";

const BATCH_SIZE = 200;

type PublishToDevicesParams = {
  devices: DeviceEntity[];
  buildTopic: (deviceId: string) => string;
  payload: string;
};

type BatchResult = {
  successCount: number;
  failureCount: number;
};

@Injectable()
@Processor("publish")
export class PublisherProcessor extends WorkerHost {
  private readonly logger = new Logger(PublisherProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mqttProvider: MqttProvider,
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

    await this.dataSource.getRepository(CampaignEntity).update(campaignId, {
      status: CampaignStatusEnum.PUBLISHING,
    });

    const devices = await this.dataSource.getRepository(DeviceEntity).find();

    const apiBaseUrl = "http://localhost:3000";

    const manifest: Manifest = {
      manifestId: randomUUID(),
      campaignId: campaign.id,
      version: campaign.version,
      startAt: Number(campaign.startAt),
      expireAt: Number(campaign.expireAt),
      templateUrl: `${apiBaseUrl}/templates/${campaign.id}/index.html`,
      assets: campaign.assets.map((a) => ({
        url: a.url,
        checksum: a.checksum ?? "",
        sizeBytes: Number(a.sizeBytes ?? 0),
      })),
    };

    const { successCount, failureCount } =
      await this.publishToDevicesInBatches({
        devices,
        buildTopic: (deviceId) => TOPICS.NOTIFICATIONS(deviceId),
        payload: JSON.stringify(manifest),
      });

    await this.dataSource.getRepository(CampaignEntity).update(campaignId, {
      status: CampaignStatusEnum.ACTIVE,
    });

    this.logger.log(
      `Campaign ${campaignId} published to ${devices.length} devices — success: ${successCount}, failed: ${failureCount}`,
    );
  }

  private async handleCancel(job: Job) {
    const { campaignId } = job.data;

    const devices = await this.dataSource.getRepository(DeviceEntity).find();

    const { successCount, failureCount } =
      await this.publishToDevicesInBatches({
        devices,
        buildTopic: (deviceId) => TOPICS.CONTROL(deviceId),
        payload: JSON.stringify({ type: "revoke", campaignId }),
      });

    this.logger.log(
      `Campaign ${campaignId} revoke sent to ${devices.length} devices — success: ${successCount}, failed: ${failureCount}`,
    );
  }

  private async publishToDevicesInBatches({
    devices,
    buildTopic,
    payload,
  }: PublishToDevicesParams): Promise<BatchResult> {
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < devices.length; i += BATCH_SIZE) {
      const batch = devices.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((device) =>
          this.mqttProvider.publishWithTimeout({
            topic: buildTopic(device.deviceId),
            payload,
            qos: 1,
          }),
        ),
      );

      results.forEach((result, j) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failureCount++;
          this.logger.error(
            `Failed to publish to device ${batch[j]?.deviceId}: ${result.reason}`,
          );
        }
      });
    }

    return { successCount, failureCount };
  }
}
