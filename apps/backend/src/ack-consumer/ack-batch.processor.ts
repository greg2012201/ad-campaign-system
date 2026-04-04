import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Job } from "bullmq";
import {
  DeliveryEventEntity,
  DeliveryEventTypeEnum,
} from "./delivery-event.entity";
import { DeviceEntity } from "../devices/device.entity";
import { ACK_QUEUE_NAME, EVENT_TYPE_MAP } from "./ack-consumer.service";

type AckEventJobItem = {
  eventId: string;
  eventType: string;
  deviceId: string;
  campaignId: string;
  version: number;
  timestamp: number;
  payload?: Record<string, unknown>;
};

type BatchJobData = {
  events: AckEventJobItem[];
};

type MappedDeliveryEvent = {
  eventId: string;
  deviceId: string;
  campaignId: string;
  version: number;
  eventType: DeliveryEventTypeEnum;
  payload: any;
};

const DB_CHUNK_SIZE = 500;
const DEVICE_UPDATE_CHUNK_SIZE = 5000;

function chunk<T>(array: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

@Processor(ACK_QUEUE_NAME, { concurrency: 3 })
export class AckBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AckBatchProcessor.name);

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async process(job: Job<BatchJobData>) {
    const { events } = job.data;

    const deliveryValues: MappedDeliveryEvent[] = [];

    for (const event of events) {
      const mappedType = EVENT_TYPE_MAP[event.eventType];
      if (!mappedType) continue;

      deliveryValues.push({
        eventId: event.eventId,
        deviceId: event.deviceId,
        campaignId: event.campaignId,
        version: event.version,
        eventType: mappedType,
        payload: event.payload ?? null,
      });
    }

    const poolSize = (this.dataSource.options as any).extra?.max ?? 10;
    const maxParallelChunks = Math.max(1, Math.floor(poolSize / 4));

    const insertChunks = chunk(deliveryValues, DB_CHUNK_SIZE);

    for (let i = 0; i < insertChunks.length; i += maxParallelChunks) {
      const batch = insertChunks.slice(i, i + maxParallelChunks);
      await Promise.all(
        batch.map((values) =>
          this.dataSource
            .getRepository(DeliveryEventEntity)
            .createQueryBuilder()
            .insert()
            .values(values)
            .orIgnore()
            .execute(),
        ),
      );
    }

    const uniqueDeviceIds = [...new Set(events.map((e) => e.deviceId))];

    for (const deviceIdBatch of chunk(uniqueDeviceIds, DEVICE_UPDATE_CHUNK_SIZE)) {
      await this.dataSource
        .createQueryBuilder()
        .update(DeviceEntity)
        .set({ lastSeen: () => "NOW()" })
        .whereInIds(deviceIdBatch)
        .execute();
    }

    this.logger.log(
      `Batch processed: ${events.length} events, ${uniqueDeviceIds.length} devices`,
    );
  }
}
