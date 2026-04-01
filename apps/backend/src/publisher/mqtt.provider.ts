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
  private clients: MqttClient[] = [];
  private roundRobinIndex = 0;
  private poolSize: number;
  private publishTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.poolSize = this.configService.get<number>("MQTT_POOL_SIZE", 4);
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

    for (let i = 0; i < this.poolSize; i++) {
      const client = mqtt.connect(brokerUrl);

      client.on("connect", () => {
        this.logger.log(`Client ${i} connected to MQTT broker at ${brokerUrl}`);
      });

      client.on("reconnect", () => {
        this.logger.log(`Client ${i} reconnecting to MQTT broker...`);
      });

      client.on("error", (error) => {
        this.logger.error(
          `Client ${i} MQTT error: ${error.message}`,
          error.stack,
        );
      });

      client.on("close", () => {
        this.logger.log(`Client ${i} MQTT connection closed`);
      });

      this.clients.push(client);
    }
  }

  onModuleDestroy() {
    for (const client of this.clients) {
      client.end();
    }
  }

  private getNextClient() {
    const client = this.clients[this.roundRobinIndex % this.clients.length]!;
    this.roundRobinIndex++;
    return client;
  }

  publish({ topic, payload, qos = 1, retain = false }: PublishParams) {
    const client = this.getNextClient();
    return new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, { qos, retain }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public publishWithTimeout({
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

      const client = this.getNextClient();
      client.publish(topic, payload, { qos, retain }, (error) => {
        clearTimeout(timer);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  getClient() {
    return this.clients[0];
  }

  subscribe({ topic, qos = 1 }: SubscribeParams) {
    return new Promise<void>((resolve, reject) => {
      this.clients[0]!.subscribe(topic, { qos }, (error) => {
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
    this.clients[0]!.on("message", handler);
  }
}
