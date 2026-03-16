import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { CampaignEntity, CampaignStatusEnum } from "./campaign.entity";
import { CampaignAssetEntity } from "./campaign-asset.entity";
import { OutboxEntity } from "../outbox/outbox.entity";
import { CreateCampaignDto } from "./dtos/create-campaign.dto";
import { CampaignListQueryDto } from "./dtos/campaign-list-response.dto";

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCampaignDto) {
    const existing = await this.campaignRepository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
      relations: ["assets"],
    });

    if (existing) {
      return existing;
    }

    const campaign = await this.dataSource.transaction(async (manager) => {
      const campaignEntity = manager.create(CampaignEntity, {
        name: dto.name,
        startAt: dto.startAt,
        expireAt: dto.expireAt,
        metadata: dto.metadata ?? null,
        idempotencyKey: dto.idempotencyKey,
        status: CampaignStatusEnum.DRAFT,
      });

      campaignEntity.assets = dto.assets.map((asset) =>
        manager.create(CampaignAssetEntity, {
          assetType: asset.assetType,
          url: asset.url,
          durationMs: asset.durationMs ?? null,
        }),
      );

      const savedCampaign = await manager.save(CampaignEntity, campaignEntity);

      const outboxEntry = manager.create(OutboxEntity, {
        aggregateType: "campaign",
        aggregateId: savedCampaign.id,
        eventType: "campaign_created",
        payload: {
          campaignId: savedCampaign.id,
          version: savedCampaign.version,
        },
      });

      await manager.save(OutboxEntity, outboxEntry);

      return savedCampaign;
    });

    return this.campaignRepository.findOne({
      where: { id: campaign.id },
      relations: ["assets"],
    });
  }

  async findAll(query: CampaignListQueryDto) {
    const { status, offset, limit } = query;

    const [data, total] = await this.campaignRepository.findAndCount({
      where: status ? { status } : {},
      relations: ["assets"],
      order: { createdAt: "DESC" },
      skip: offset,
      take: limit,
    });

    return { data, total, offset, limit };
  }

  async findById(id: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ["assets"],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with id ${id} not found`);
    }

    return campaign;
  }

  async cancel(id: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with id ${id} not found`);
    }

    await this.dataSource.transaction(async (manager) => {
      campaign.status = CampaignStatusEnum.CANCELLED;
      await manager.save(CampaignEntity, campaign);

      const outboxEntry = manager.create(OutboxEntity, {
        aggregateType: "campaign",
        aggregateId: campaign.id,
        eventType: "campaign_cancelled",
        payload: {
          campaignId: campaign.id,
          version: campaign.version,
        },
      });

      await manager.save(OutboxEntity, outboxEntry);
    });

    return this.campaignRepository.findOne({
      where: { id },
      relations: ["assets"],
    });
  }
}
