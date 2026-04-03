import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AckConsumerService, ackEventSchema } from "./ack-consumer.service";
import { MqttProvider } from "../publisher/mqtt.provider";

const ACK_TOPIC_PATTERN = "devices/+/acks";

@Injectable()
export class AckMqttSubscriber implements OnModuleInit {
  private readonly logger = new Logger(AckMqttSubscriber.name);

  constructor(
    private readonly mqttProvider: MqttProvider,
    private readonly ackConsumerService: AckConsumerService,
  ) {}

  async onModuleInit() {
    this.mqttProvider.onMessage((topic, payload) => {
      this.handleMessage(topic, payload);
    });

    await this.mqttProvider.subscribe({
      topic: ACK_TOPIC_PATTERN,
      qos: 1,
    });

    this.logger.log(`Listening for ack events on ${ACK_TOPIC_PATTERN}`);
  }

  private handleMessage(topic: string, payload: Buffer) {
    if (!topic.startsWith("devices/") || !topic.endsWith("/acks")) {
      return;
    }

    let raw: unknown;

    try {
      raw = JSON.parse(payload.toString());
    } catch {
      this.logger.warn(`Malformed JSON on topic ${topic}, discarding`);
      return;
    }

    const result = ackEventSchema.safeParse(raw);

    if (!result.success) {
      this.logger.warn(
        `Invalid ack event structure on topic ${topic}, discarding`,
      );
      return;
    }

    this.ackConsumerService.processEvent(result.data).catch((error) => {
      this.logger.error(`Error processing ack event: ${error}`);
    });
  }
}
