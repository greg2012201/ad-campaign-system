import mqtt from "mqtt";
import type { MqttClient, IClientOptions } from "mqtt";

type MqttMessage = {
  topic: string;
  payload: string;
  timestamp: number;
};

type WaitForMessageOptions = {
  timeout?: number;
  filter?: (topic: string, payload: Record<string, unknown>) => boolean;
};

class MqttTestHelper {
  private client: MqttClient | null = null;
  private messages: MqttMessage[] = [];
  private subscribers: Array<(msg: MqttMessage) => void> = [];
  private brokerUrl: string;

  constructor(brokerUrl: string) {
    this.brokerUrl = brokerUrl;
  }

  async connect(options: IClientOptions = {}) {
    return new Promise<void>((resolve, reject) => {
      this.client = mqtt.connect(this.brokerUrl, {
        clientId: `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        clean: true,
        connectTimeout: 10000,
        ...options,
      });

      this.client.on("connect", () => resolve());
      this.client.on("error", (err) => reject(err));

      this.client.on("message", (topic, payload) => {
        const msg: MqttMessage = {
          topic,
          payload: payload.toString(),
          timestamp: Date.now(),
        };
        this.messages.push(msg);
        for (const sub of this.subscribers) {
          sub(msg);
        }
      });
    });
  }

  async subscribe(topicPattern: string, qos: 0 | 1 | 2 = 1) {
    if (!this.client) throw new Error("MQTT client not connected");

    return new Promise<void>((resolve, reject) => {
      this.client!.subscribe(topicPattern, { qos }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async publish({
    topic,
    payload,
    qos = 1,
  }: {
    topic: string;
    payload: string;
    qos?: 0 | 1 | 2;
  }) {
    if (!this.client) throw new Error("MQTT client not connected");

    return new Promise<void>((resolve, reject) => {
      this.client!.publish(topic, payload, { qos }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  waitForMessage(options: WaitForMessageOptions = {}) {
    const { timeout = 30000, filter } = options;

    const existing = this.messages.find((msg) => {
      if (!filter) return true;
      try {
        return filter(msg.topic, JSON.parse(msg.payload));
      } catch {
        return false;
      }
    });

    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise<MqttMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.subscribers.indexOf(handler);
        if (idx !== -1) this.subscribers.splice(idx, 1);
        reject(
          new Error(
            `Timed out after ${timeout}ms waiting for MQTT message`,
          ),
        );
      }, timeout);

      const handler = (msg: MqttMessage) => {
        const matches = (() => {
          if (!filter) return true;
          try {
            return filter(msg.topic, JSON.parse(msg.payload));
          } catch {
            return false;
          }
        })();

        if (matches) {
          clearTimeout(timer);
          const idx = this.subscribers.indexOf(handler);
          if (idx !== -1) this.subscribers.splice(idx, 1);
          resolve(msg);
        }
      };

      this.subscribers.push(handler);
    });
  }

  waitForMessages({
    count,
    timeout = 30000,
    filter,
  }: {
    count: number;
    timeout?: number;
    filter?: (topic: string, payload: Record<string, unknown>) => boolean;
  }) {
    return new Promise<MqttMessage[]>((resolve, reject) => {
      const collected: MqttMessage[] = [];

      const existingMatches = this.messages.filter((msg) => {
        if (!filter) return true;
        try {
          return filter(msg.topic, JSON.parse(msg.payload));
        } catch {
          return false;
        }
      });

      collected.push(...existingMatches);
      if (collected.length >= count) {
        return resolve(collected.slice(0, count));
      }

      const timer = setTimeout(() => {
        const idx = this.subscribers.indexOf(handler);
        if (idx !== -1) this.subscribers.splice(idx, 1);
        reject(
          new Error(
            `Timed out after ${timeout}ms waiting for ${count} MQTT messages (received ${collected.length})`,
          ),
        );
      }, timeout);

      const handler = (msg: MqttMessage) => {
        const matches = (() => {
          if (!filter) return true;
          try {
            return filter(msg.topic, JSON.parse(msg.payload));
          } catch {
            return false;
          }
        })();

        if (matches) {
          collected.push(msg);
          if (collected.length >= count) {
            clearTimeout(timer);
            const idx = this.subscribers.indexOf(handler);
            if (idx !== -1) this.subscribers.splice(idx, 1);
            resolve(collected.slice(0, count));
          }
        }
      };

      this.subscribers.push(handler);
    });
  }

  getMessages() {
    return [...this.messages];
  }

  getMessagesForTopic(topic: string) {
    return this.messages.filter((m) => m.topic === topic);
  }

  clearMessages() {
    this.messages = [];
  }

  async disconnect() {
    if (!this.client) return;

    return new Promise<void>((resolve) => {
      this.client!.end(false, () => {
        this.client = null;
        this.messages = [];
        this.subscribers = [];
        resolve();
      });
    });
  }
}

function createAckPayload({
  eventType,
  deviceId,
  campaignId,
  version,
}: {
  eventType: "INSTALL_ACK" | "DISPLAY_START" | "DISPLAY_COMPLETE" | "ERROR";
  deviceId: string;
  campaignId: string;
  version: number;
}) {
  return JSON.stringify({
    eventId: crypto.randomUUID(),
    eventType,
    deviceId,
    campaignId,
    version,
    timestamp: Date.now(),
  });
}

type ManifestPayloadParams = {
  campaignId: string;
  templateUrl: string;
  manifestId?: string;
  version?: number;
  startAt?: number;
  expireAt?: number;
  assets?: Array<{ url: string; checksum: string; sizeBytes: number }>;
};

function createManifestPayload({
  campaignId,
  templateUrl,
  manifestId,
  version = 1,
  startAt,
  expireAt,
  assets = [],
}: ManifestPayloadParams) {
  return JSON.stringify({
    manifestId: manifestId ?? crypto.randomUUID(),
    campaignId,
    version,
    startAt: startAt ?? Date.now() - 1000,
    expireAt: expireAt ?? Date.now() + 300_000,
    templateUrl,
    assets,
  });
}

type ControlPayloadParams = {
  type: string;
  campaignId: string;
};

function createControlPayload({ type, campaignId }: ControlPayloadParams) {
  return JSON.stringify({ type, campaignId });
}

export { MqttTestHelper, createAckPayload, createManifestPayload, createControlPayload };
export type { MqttMessage, WaitForMessageOptions, ManifestPayloadParams, ControlPayloadParams };
