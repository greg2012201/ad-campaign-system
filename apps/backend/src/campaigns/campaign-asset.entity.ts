import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { CampaignEntity } from "./campaign.entity";

export enum AssetTypeEnum {
  IMAGE = "image",
  VIDEO = "video",
  HTML = "html",
}

@Entity("campaign_assets")
export class CampaignAssetEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  campaignId: string;

  @Column({ type: "enum", enum: AssetTypeEnum })
  assetType: AssetTypeEnum;

  @Column({ type: "text" })
  url: string;

  @Column({ type: "text", nullable: true })
  checksum: string | null;

  @Column({ type: "int", nullable: true })
  durationMs: number | null;

  @Column({ type: "bigint", nullable: true })
  sizeBytes: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.assets, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "campaignId" })
  campaign: CampaignEntity;
}
