import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { z } from "zod";
import { EVENT_TYPES } from "@campaign-system/shared";
import {
  DeliveryEventEntity,
  DeliveryEventTypeEnum,
} from "./delivery-event.entity";
import { DeviceEntity } from "../devices/device.entity";

const eventTypes = Object.values(EVENT_TYPES);

export const ackEventSchema = z.object({
  eventId: z.string(),
  eventType: z.enum(eventTypes as [string, ...string[]]),
  deviceId: z.string(),
  campaignId: z.string(),
  version: z.number(),
  timestamp: z.number(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

type AckEvent = z.infer<typeof ackEventSchema>;

const EVENT_TYPE_MAP: Record<AckEvent["eventType"], DeliveryEventTypeEnum> = {
  [EVENT_TYPES.INSTALL_ACK]: DeliveryEventTypeEnum.INSTALL_ACK,
  [EVENT_TYPES.DISPLAY_START]: DeliveryEventTypeEnum.DISPLAY_START,
  [EVENT_TYPES.DISPLAY_COMPLETE]: DeliveryEventTypeEnum.DISPLAY_COMPLETE,
  [EVENT_TYPES.REVOKE_ACK]: DeliveryEventTypeEnum.REVOKE_ACK,
  [EVENT_TYPES.ERROR]: DeliveryEventTypeEnum.ERROR,
};

@Injectable()
export class AckConsumerService {
  private readonly logger = new Logger(AckConsumerService.name);

  constructor(private readonly dataSource: DataSource) {}

  async processEvent(event: AckEvent) {
    const mappedEventType = EVENT_TYPE_MAP[event.eventType];

    if (!mappedEventType) {
      this.logger.warn(
        `Unknown event type: ${event.eventType}, discarding`,
      );
      return;
    }

    try {
      await this.dataSource
        .getRepository(DeliveryEventEntity)
        .createQueryBuilder()
        .insert()
        .values({
          eventId: event.eventId,
          deviceId: event.deviceId,
          campaignId: event.campaignId,
          version: event.version,
          eventType: mappedEventType,
          payload: (event.payload ?? null) as any,
        })
        .orIgnore()
        .execute();

      await this.dataSource
        .getRepository(DeviceEntity)
        .update(event.deviceId, { lastSeen: new Date() });

      this.logger.log(
        `Processed ${event.eventType} from ${event.deviceId} for campaign ${event.campaignId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process event ${event.eventId}: ${error}`,
      );
      throw error;
    }
  }
}
