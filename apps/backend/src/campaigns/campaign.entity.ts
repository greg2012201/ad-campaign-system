import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { CampaignAssetEntity } from "./campaign-asset.entity";
import { DeliveryEventEntity } from "../ack-consumer/delivery-event.entity";

export enum CampaignStatusEnum {
  DRAFT = "draft",
  BUILDING = "building",
  READY = "ready",
  PUBLISHING = "publishing",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

@Entity("campaigns")
export class CampaignEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "int", default: 1 })
  version: number;

  @Index()
  @Column({ type: "bigint" })
  startAt: number;

  @Column({ type: "bigint" })
  expireAt: number;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({
    type: "enum",
    enum: CampaignStatusEnum,
    default: CampaignStatusEnum.DRAFT,
  })
  status: CampaignStatusEnum;

  @Column({ type: "text", nullable: true })
  createdBy: string | null;

  @Column({ type: "uuid", nullable: true, unique: true })
  idempotencyKey: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CampaignAssetEntity, (asset) => asset.campaign, {
    cascade: true,
  })
  assets: CampaignAssetEntity[];

  @OneToMany(() => DeliveryEventEntity, (event) => event.campaign)
  deliveryEvents: DeliveryEventEntity[];
}
