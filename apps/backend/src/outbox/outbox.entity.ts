import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("outbox")
@Index(["processed", "createdAt"])
export class OutboxEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text" })
  aggregateType: string;

  @Column({ type: "uuid" })
  aggregateId: string;

  @Column({ type: "text" })
  eventType: string;

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: "boolean", default: false })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  processedAt: Date | null;
}
