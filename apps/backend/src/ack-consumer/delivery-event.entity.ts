import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { CampaignEntity } from "../campaigns/campaign.entity";
import { DeviceEntity } from "../devices/device.entity";

export enum DeliveryEventTypeEnum {
  INSTALL_ACK = "install_ack",
  DISPLAY_START = "display_start",
  DISPLAY_COMPLETE = "display_complete",
  ERROR = "error",
}

@Entity("delivery_events")
export class DeliveryEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", unique: true })
  eventId: string;

  @Index()
  @Column({ type: "text" })
  deviceId: string;

  @Index()
  @Column({ type: "uuid" })
  campaignId: string;

  @Column({ type: "int" })
  version: number;

  @Column({ type: "enum", enum: DeliveryEventTypeEnum })
  eventType: DeliveryEventTypeEnum;

  @Column({ type: "uuid", nullable: true })
  assetId: string | null;

  @Column({ type: "jsonb", nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => DeviceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deviceId", referencedColumnName: "deviceId" })
  device: DeviceEntity;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.deliveryEvents, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "campaignId" })
  campaign: CampaignEntity;
}
