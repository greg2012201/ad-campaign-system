import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DataSource } from "typeorm";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CampaignEntity,
  CampaignStatusEnum,
} from "../campaigns/campaign.entity";
import { OutboxEntity } from "../outbox/outbox.entity";
import { generateTemplate } from "./template-generator";

@Injectable()
@Processor("template-build")
export class TemplateProcessor extends WorkerHost {
  private readonly logger = new Logger(TemplateProcessor.name);

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async process(job: Job) {
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
      status: CampaignStatusEnum.BUILDING,
    });

    const html = generateTemplate({
      campaignId: campaign.id,
      name: campaign.name,
      startAt: Number(campaign.startAt),
      expireAt: Number(campaign.expireAt),
      assets: campaign.assets.map((a) => ({
        id: a.id,
        assetType: a.assetType,
        url: a.url,
        durationMs: a.durationMs,
      })),
    });

    const dir = join(process.cwd(), "storage", campaignId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), html);

    await this.dataSource.getRepository(CampaignEntity).update(campaignId, {
      status: CampaignStatusEnum.READY,
    });

    await this.dataSource.getRepository(OutboxEntity).save({
      aggregateType: "campaign",
      aggregateId: campaignId,
      eventType: "template_ready",
      payload: { campaignId, version: campaign.version },
    });

    this.logger.log(
      `Template built for campaign ${campaignId} v${campaign.version}`,
    );
  }
}
