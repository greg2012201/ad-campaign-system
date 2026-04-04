import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { z } from "zod";
import { EVENT_TYPES } from "@campaign-system/shared";
import { DeliveryEventTypeEnum } from "./delivery-event.entity";

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

export type AckEvent = z.infer<typeof ackEventSchema>;

export const EVENT_TYPE_MAP: Record<
  AckEvent["eventType"],
  DeliveryEventTypeEnum
> = {
  [EVENT_TYPES.INSTALL_ACK]: DeliveryEventTypeEnum.INSTALL_ACK,
  [EVENT_TYPES.DISPLAY_START]: DeliveryEventTypeEnum.DISPLAY_START,
  [EVENT_TYPES.DISPLAY_COMPLETE]: DeliveryEventTypeEnum.DISPLAY_COMPLETE,
  [EVENT_TYPES.REVOKE_ACK]: DeliveryEventTypeEnum.REVOKE_ACK,
  [EVENT_TYPES.ERROR]: DeliveryEventTypeEnum.ERROR,
};

export const ACK_QUEUE_NAME = "ack-events-batch";

const FLUSH_INTERVAL_MS = 500;
const MAX_BUFFER_SIZE = 2000;

@Injectable()
export class AckConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(AckConsumerService.name);
  private buffer: AckEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval>;

  constructor(
    @InjectQueue(ACK_QUEUE_NAME) private readonly ackQueue: Queue,
  ) {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error(`Flush failed: ${error}`);
      });
    }, FLUSH_INTERVAL_MS);
  }

  async onModuleDestroy() {
    clearInterval(this.flushTimer);
    await this.flush();
  }

  bufferEvent(event: AckEvent) {
    const mappedEventType = EVENT_TYPE_MAP[event.eventType];

    if (!mappedEventType) {
      this.logger.warn(`Unknown event type: ${event.eventType}, discarding`);
      return;
    }

    this.buffer.push(event);

    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      void this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const events = this.buffer;
    this.buffer = [];

    try {
      await this.ackQueue.add(
        "batch",
        { events },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
      this.logger.debug(`Flushed ${events.length} events to queue`);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue batch of ${events.length} events: ${error}`,
      );
      this.buffer = [...events, ...this.buffer];
    }
  }
}
