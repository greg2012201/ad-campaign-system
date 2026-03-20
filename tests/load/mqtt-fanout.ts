import { check } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import ws from "k6/ws";
import { Counter, Trend } from "k6/metrics";

const MQTT_BROKER_URL = __ENV.K6_MQTT_BROKER_URL || "ws://localhost:9001";
const DEVICE_PREFIX = __ENV.K6_MQTT_DEVICE_PREFIX || "load-dev";

const messagesPublished = new Counter("mqtt_messages_published");
const messagesReceived = new Counter("mqtt_messages_received");
const mqttRtt = new Trend("mqtt_round_trip_ms");

type MqttConnectParams = {
  clientId: string;
};

type MqttPublishParams = {
  topic: string;
  payload: string;
  qos?: number;
  packetId?: number;
};

type MqttSubscribeParams = {
  packetId: number;
  topic: string;
};

function buildMqttConnectPacket({ clientId }: MqttConnectParams) {
  const protocolName = "MQTT";
  const protocolLevel = 4;
  const connectFlags = 0x02;
  const keepAlive = 60;

  const clientIdBytes = new TextEncoder().encode(clientId);

  const remainingLength =
    2 + protocolName.length + 1 + 1 + 2 + 2 + clientIdBytes.length;

  const buffer = new ArrayBuffer(2 + remainingLength);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint8(offset++, 0x10);
  view.setUint8(offset++, remainingLength);

  view.setUint16(offset, protocolName.length);
  offset += 2;
  for (let i = 0; i < protocolName.length; i++) {
    view.setUint8(offset++, protocolName.charCodeAt(i));
  }

  view.setUint8(offset++, protocolLevel);
  view.setUint8(offset++, connectFlags);
  view.setUint16(offset, keepAlive);
  offset += 2;

  view.setUint16(offset, clientIdBytes.length);
  offset += 2;
  for (let i = 0; i < clientIdBytes.length; i++) {
    view.setUint8(offset++, clientIdBytes[i]);
  }

  return buffer;
}

function buildMqttSubscribePacket({ packetId, topic }: MqttSubscribeParams) {
  const topicBytes = new TextEncoder().encode(topic);
  const remainingLength = 2 + 2 + topicBytes.length + 1;

  const buffer = new ArrayBuffer(2 + remainingLength);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint8(offset++, 0x82);
  view.setUint8(offset++, remainingLength);

  view.setUint16(offset, packetId);
  offset += 2;

  view.setUint16(offset, topicBytes.length);
  offset += 2;
  for (let i = 0; i < topicBytes.length; i++) {
    view.setUint8(offset++, topicBytes[i]);
  }

  view.setUint8(offset, 1);

  return buffer;
}

function buildMqttPublishPacket({
  topic,
  payload,
  qos = 1,
  packetId,
}: MqttPublishParams) {
  const topicBytes = new TextEncoder().encode(topic);
  const payloadBytes = new TextEncoder().encode(payload);

  const remainingLength =
    2 + topicBytes.length + (qos > 0 ? 2 : 0) + payloadBytes.length;

  const buffer = new ArrayBuffer(2 + remainingLength);
  const view = new DataView(buffer);
  let offset = 0;

  const fixedHeader = 0x30 | (qos << 1);
  view.setUint8(offset++, fixedHeader);
  view.setUint8(offset++, remainingLength);

  view.setUint16(offset, topicBytes.length);
  offset += 2;
  for (let i = 0; i < topicBytes.length; i++) {
    view.setUint8(offset++, topicBytes[i]);
  }

  if (qos > 0 && packetId) {
    view.setUint16(offset, packetId);
    offset += 2;
  }

  for (let i = 0; i < payloadBytes.length; i++) {
    view.setUint8(offset++, payloadBytes[i]);
  }

  return buffer;
}

export default function () {
  const deviceId = `${DEVICE_PREFIX}-${String(__VU).padStart(4, "0")}`;
  const notificationsTopic = `devices/${deviceId}/notifications`;
  const acksTopic = `devices/${deviceId}/acks`;

  const res = ws.connect(MQTT_BROKER_URL, {}, function (socket) {
    let packetIdCounter = 1;

    socket.on("open", function () {
      socket.sendBinary(
        buildMqttConnectPacket({ clientId: `k6-${deviceId}` })
      );
    });

    socket.on("binaryMessage", function () {
      messagesReceived.add(1);
    });

    socket.setTimeout(function () {
      socket.sendBinary(
        buildMqttSubscribePacket({
          packetId: packetIdCounter++,
          topic: notificationsTopic,
        })
      );
    }, 500);

    socket.setTimeout(function () {
      const ackPayload = JSON.stringify({
        eventId: uuidv4(),
        deviceId,
        campaignId: uuidv4(),
        version: 1,
        eventType: "INSTALL_ACK",
        timestamp: Date.now(),
      });

      socket.sendBinary(
        buildMqttPublishPacket({
          topic: acksTopic,
          payload: ackPayload,
          qos: 1,
          packetId: packetIdCounter++,
        })
      );
      messagesPublished.add(1);
    }, 1500);

    socket.setTimeout(function () {
      const displayPayload = JSON.stringify({
        eventId: uuidv4(),
        deviceId,
        campaignId: uuidv4(),
        version: 1,
        eventType: "DISPLAY_START",
        timestamp: Date.now(),
      });

      socket.sendBinary(
        buildMqttPublishPacket({
          topic: acksTopic,
          payload: displayPayload,
          qos: 1,
          packetId: packetIdCounter++,
        })
      );
      messagesPublished.add(1);
    }, 2500);

    socket.setTimeout(function () {
      const completePayload = JSON.stringify({
        eventId: uuidv4(),
        deviceId,
        campaignId: uuidv4(),
        version: 1,
        eventType: "DISPLAY_COMPLETE",
        timestamp: Date.now(),
      });

      socket.sendBinary(
        buildMqttPublishPacket({
          topic: acksTopic,
          payload: completePayload,
          qos: 1,
          packetId: packetIdCounter++,
        })
      );
      messagesPublished.add(1);
    }, 3500);

    socket.setTimeout(function () {
      socket.close();
    }, 5000);
  });

  check(res, {
    "websocket connected": (r) => r && r.status === 101,
  });
}
