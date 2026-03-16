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
};

@Injectable()
export class MqttProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttProvider.name);
  private client: MqttClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const brokerUrl = this.configService.get<string>(
      "MQTT_BROKER_URL",
      "mqtt://localhost:1883",
    );

    this.client = mqtt.connect(brokerUrl);

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

  publish({ topic, payload, qos = 1 }: PublishParams) {
    return new Promise<void>((resolve, reject) => {
      this.client.publish(topic, payload, { qos }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  getClient() {
    return this.client;
  }
}
