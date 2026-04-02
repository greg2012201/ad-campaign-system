import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import mqtt, { MqttClient } from "mqtt";

type PublishParams = {
  topic: string;
  payload: string | Buffer;
  qos?: 0 | 1 | 2;
  retain?: boolean;
};

type PublishWithTimeoutParams = {
  topic: string;
  payload: string | Buffer;
  qos?: 0 | 1 | 2;
  timeout?: number;
  retain?: boolean;
};

type SubscribeParams = {
  topic: string;
  qos?: 0 | 1 | 2;
};

type MessageHandler = (topic: string, payload: Buffer) => void;

@Injectable()
export class MqttProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttProvider.name);
  private client!: MqttClient;
  private publishTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.publishTimeoutMs = this.configService.get<number>(
      "MQTT_PUBLISH_TIMEOUT_MS",
      5000,
    );
  }

  onModuleInit() {
    const brokerUrl = this.configService.get<string>(
      "MQTT_BROKER_URL",
      "mqtt://localhost:1883",
    );

    this.client = mqtt.connect(brokerUrl, {
      keepalive: 30,
      reconnectPeriod: 1000,
      connectTimeout: 10_000,
      clean: true,
      reschedulePings: true,
    });

    this.client.on("connect", () => {
      this.logger.log(`Connected to MQTT broker at ${brokerUrl}`);
    });

    this.client.on("reconnect", () => {
      this.logger.log("Reconnecting to MQTT broker...");
    });

    this.client.on("error", (error) => {
      this.logger.error(`MQTT error: ${error.message}`, error.stack);
    });

    this.client.on("close", () => {
      this.logger.log("MQTT connection closed");
    });
  }

  onModuleDestroy() {
    this.client.end();
  }

  publish({ topic, payload, qos = 1, retain = false }: PublishParams) {
    return new Promise<void>((resolve, reject) => {
      this.client.publish(topic, payload, { qos, retain }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  publishWithTimeout({
    topic,
    payload,
    qos = 1,
    timeout,
    retain = false,
  }: PublishWithTimeoutParams) {
    const timeoutMs = timeout ?? this.publishTimeoutMs;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `MQTT publish to "${topic}" timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.client.publish(topic, payload, { qos, retain }, (error) => {
        clearTimeout(timer);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  subscribe({ topic, qos = 1 }: SubscribeParams) {
    return new Promise<void>((resolve, reject) => {
      this.client.subscribe(topic, { qos }, (error) => {
        if (error) {
          reject(error);
        } else {
          this.logger.log(`Subscribed to ${topic}`);
          resolve();
        }
      });
    });
  }

  onMessage(handler: MessageHandler) {
    this.client.on("message", handler);
  }
}
