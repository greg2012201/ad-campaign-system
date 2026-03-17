import mqtt from "mqtt";
import { TOPICS } from "@campaign-system/shared";

type MqttClientConfig = {
  brokerUrl: string;
  deviceId: string;
};

function connectMqtt({ brokerUrl, deviceId }: MqttClientConfig) {
  const statusTopic = TOPICS.STATUS(deviceId);

  const client = mqtt.connect(brokerUrl, {
    will: {
      topic: statusTopic,
      payload: JSON.stringify({
        deviceId,
        status: "offline",
        timestamp: Date.now(),
      }),
      qos: 1,
      retain: true,
    },
  });

  client.on("connect", () => {
    console.log(`[mqtt] connected to ${brokerUrl}`);

    client.publish(
      statusTopic,
      JSON.stringify({ deviceId, status: "online", timestamp: Date.now() }),
      { qos: 1, retain: true },
    );

    client.subscribe(TOPICS.NOTIFICATIONS(deviceId), { qos: 1 });
    client.subscribe(TOPICS.CONTROL(deviceId), { qos: 1 });
  });

  client.on("reconnect", () => {
    console.log("[mqtt] reconnecting...");
  });

  client.on("error", (error: Error) => {
    console.error("[mqtt] error:", error);
  });

  client.on("close", () => {
    console.log("[mqtt] connection closed");
  });

  return client;
}

export { connectMqtt };
export type { MqttClientConfig };
