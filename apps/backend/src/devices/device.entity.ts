import { Entity, PrimaryColumn, Column } from "typeorm";

export enum DeviceStatusEnum {
  ONLINE = "online",
  OFFLINE = "offline",
}

@Entity("devices")
export class DeviceEntity {
  @PrimaryColumn({ type: "text" })
  deviceId: string;

  @Column({ type: "text", nullable: true })
  groupId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastSeen: Date | null;

  @Column({
    type: "enum",
    enum: DeviceStatusEnum,
    default: DeviceStatusEnum.OFFLINE,
  })
  status: DeviceStatusEnum;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;
}
