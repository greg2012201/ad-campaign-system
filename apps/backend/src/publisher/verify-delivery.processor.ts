import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { TOPICS } from "@campaign-system/shared";
import { CampaignEntity } from "../campaigns/campaign.entity";
import {
  DeliveryEventEntity,
  DeliveryEventTypeEnum,
} from "../ack-consumer/delivery-event.entity";
import { DeviceStreamService } from "./device-stream.service";
import { DevicePublishTracker } from "./device-publish-tracker";
import { buildManifest } from "./build-manifest";
import { MqttProvider } from "../mqtt/mqtt.provider";

const BATCH_SIZE = 200;
const VERIFY_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 3;

type VerifyJobData = {
  campaignId: string;
  version: number;
  attempt?: number;
};

type VerifyRevokeJobData = {
  campaignId: string;
  attempt?: number;
};

@Injectable()
@Processor("verify-delivery")
export class VerifyDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(VerifyDeliveryProcessor.name);

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
    if (job.name === "verify-revoke") {
      return this.handleVerifyRevoke(job as Job<VerifyRevokeJobData>);
    }

    return this.handleVerifyDelivery(job as Job<VerifyJobData>);
  }

  private async handleVerifyDelivery(job: Job<VerifyJobData>) {
    const { campaignId, version, attempt = 1 } = job.data;

    this.logger.log(
      `Verifying delivery for campaign ${campaignId} v${version} (attempt ${attempt})`,
    );

    const campaign = await this.dataSource
      .getRepository(CampaignEntity)
      .findOne({ where: { id: campaignId }, relations: ["assets"] });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found`);
      return;
    }

    const ackRows = await this.dataSource
      .getRepository(DeliveryEventEntity)
      .find({
        select: { deviceId: true },
        where: {
          campaignId,
          version,
          eventType: DeliveryEventTypeEnum.INSTALL_ACK,
        },
      });

    const ackedDeviceIds = new Set(ackRows.map((r) => r.deviceId));

    const apiBaseUrl = this.configService.get(
      "API_BASE_URL",
      "http://localhost:3000",
    );
    const manifest = buildManifest({ campaign, apiBaseUrl });
    const payload = JSON.stringify(manifest);

    let missingCount = 0;
    let republishCount = 0;

    for await (const batch of this.deviceStreamService.streamBatches({
      batchSize: BATCH_SIZE,
      excludeDeviceIds: ackedDeviceIds,
    })) {
      missingCount += batch.length;

      const results = await Promise.allSettled(
        batch.map((device) =>
          this.mqttProvider.publishWithTimeout({
            topic: TOPICS.NOTIFICATIONS(device.deviceId),
            payload,
            qos: 1,
            retain: true,
            timeout: 5000,
          }),
        ),
      );

      results.forEach((result, j) => {
        if (result.status === "fulfilled") {
          republishCount++;
        } else {
          this.logger.error(
            `Retry publish failed for device ${batch[j]?.deviceId}: ${result.reason}`,
          );
        }
      });
    }

    if (missingCount === 0) {
      this.logger.log(
        `All devices acknowledged campaign ${campaignId} v${version}`,
      );
      return;
    }

    this.logger.log(
      `Re-published to ${republishCount}/${missingCount} missing devices for campaign ${campaignId}`,
    );

    if (attempt < MAX_ATTEMPTS) {
      try {
        const nextAttempt = attempt + 1;
        await this.verifyDeliveryQueue.add(
          "verify-delivery",
          { campaignId, version, attempt: nextAttempt },
          {
            delay: VERIFY_DELAY_MS * Math.pow(2, attempt - 1),
            jobId: `verify-${campaignId}-v${version}-a${nextAttempt}`,
          },
        );
      } catch (e) {
        this.logger.error(`Failed to schedule next verify attempt: ${e}`);
      }
    } else {
      this.logger.log(
        `Max attempts reached for campaign ${campaignId} v${version}`,
      );
    }
  }

  private async handleVerifyRevoke(job: Job<VerifyRevokeJobData>) {
    const { campaignId, attempt = 1 } = job.data;

    this.logger.log(
      `Verifying revoke delivery for campaign ${campaignId} (attempt ${attempt})`,
    );

    const alreadyRevoked = await this.devicePublishTracker.getRevoked({
      campaignId,
    });

    const payload = JSON.stringify({ type: "revoke", campaignId });

    let missingCount = 0;
    let republishCount = 0;

    for await (const batch of this.deviceStreamService.streamBatches({
      batchSize: BATCH_SIZE,
      excludeDeviceIds: alreadyRevoked,
    })) {
      missingCount += batch.length;

      const results = await Promise.allSettled(
        batch.map((device) =>
          this.mqttProvider.publishWithTimeout({
            topic: TOPICS.CONTROL(device.deviceId),
            payload,
            qos: 1,
            timeout: 5000,
          }),
        ),
      );

      const revokedIds: string[] = [];

      results.forEach((result, j) => {
        if (result.status === "fulfilled") {
          republishCount++;
          revokedIds.push(batch[j]!.deviceId);
        } else {
          this.logger.error(
            `Retry revoke failed for device ${batch[j]?.deviceId}: ${result.reason}`,
          );
        }
      });

      await this.devicePublishTracker.markRevoked({
        campaignId,
        deviceIds: revokedIds,
      });
    }

    if (missingCount === 0) {
      this.logger.log(`All devices received revoke for campaign ${campaignId}`);
      return;
    }

    this.logger.log(
      `Re-sent revoke to ${republishCount}/${missingCount} missing devices for campaign ${campaignId}`,
    );

    if (attempt < MAX_ATTEMPTS) {
      const nextAttempt = attempt + 1;
      await this.verifyDeliveryQueue.add(
        "verify-revoke",
        { campaignId, attempt: nextAttempt },
        {
          delay: VERIFY_DELAY_MS * Math.pow(2, attempt - 1),
          jobId: `verify-revoke-${campaignId}-a${nextAttempt}`,
        },
      );
    } else {
      this.logger.log(
        `Max revoke verify attempts reached for campaign ${campaignId}`,
      );
    }
  }
}
