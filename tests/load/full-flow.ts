import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import ws from "k6/ws";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.K6_API_BASE_URL || "http://localhost:3000";
const MQTT_BROKER_URL = __ENV.K6_MQTT_BROKER_URL || "ws://localhost:9001";
const DEVICE_PREFIX = __ENV.K6_MQTT_DEVICE_PREFIX || "load-dev";

const campaignsCreated = new Counter("campaigns_created");
const acksPublished = new Counter("acks_published");
const fullFlowDuration = new Trend("full_flow_duration_ms");

const headers = { "Content-Type": "application/json" };

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

export default function () {
  const flowStart = Date.now();
  const deviceId = `${DEVICE_PREFIX}-${String(__VU).padStart(4, "0")}`;
  const campaignId = uuidv4();

  const campaignPayload = JSON.stringify({
    name: `full-flow-${campaignId.slice(0, 8)}`,
    startAt: Date.now() + 60_000,
    expireAt: Date.now() + 86_400_000,
    assets: [
      {
        assetType: "image",
        url: "https://picsum.photos/1920/1080",
        durationMs: 10000,
      },
    ],
    metadata: { source: "k6-full-flow", vuId: __VU, iteration: __ITER },
    idempotencyKey: uuidv4(),
  });

  const createRes = http.post(`${BASE_URL}/campaigns`, campaignPayload, {
    headers,
    tags: { name: "full-flow: POST /campaigns" },
  });

  const created = check(createRes, {
    "campaign created": (r) => r.status === 201,
  });

  if (!created) {
    return;
  }

  campaignsCreated.add(1);
  const createdCampaign = JSON.parse(createRes.body as string);

  sleep(1);

  const notificationsTopic = `devices/${deviceId}/notifications`;
  const acksTopic = `devices/${deviceId}/acks`;

  const wsRes = ws.connect(MQTT_BROKER_URL, {}, function (socket) {
    let packetIdCounter = 1;

    socket.on("open", function () {
      socket.sendBinary(
        buildMqttConnectPacket({ clientId: `k6-full-${deviceId}-${__ITER}` })
      );
    });

    socket.setTimeout(function () {
      socket.sendBinary(
        buildMqttSubscribePacket({
          packetId: packetIdCounter++,
          topic: notificationsTopic,
        })
      );
    }, 300);

    socket.setTimeout(function () {
      const installAck = JSON.stringify({
        eventId: uuidv4(),
        deviceId,
        campaignId: createdCampaign.id,
        version: 1,
        eventType: "INSTALL_ACK",
        timestamp: Date.now(),
      });

      socket.sendBinary(
        buildMqttPublishPacket({
          topic: acksTopic,
          payload: installAck,
          qos: 1,
          packetId: packetIdCounter++,
        })
      );
      acksPublished.add(1);
    }, 1000);

    socket.setTimeout(function () {
      const displayStart = JSON.stringify({
        eventId: uuidv4(),
        deviceId,
        campaignId: createdCampaign.id,
        version: 1,
        eventType: "DISPLAY_START",
        timestamp: Date.now(),
      });

      socket.sendBinary(
        buildMqttPublishPacket({
          topic: acksTopic,
          payload: displayStart,
          qos: 1,
          packetId: packetIdCounter++,
        })
      );
      acksPublished.add(1);
    }, 2000);

    socket.setTimeout(function () {
      const displayComplete = JSON.stringify({
        eventId: uuidv4(),
        deviceId,
        campaignId: createdCampaign.id,
        version: 1,
        eventType: "DISPLAY_COMPLETE",
        timestamp: Date.now(),
      });

      socket.sendBinary(
        buildMqttPublishPacket({
          topic: acksTopic,
          payload: displayComplete,
          qos: 1,
          packetId: packetIdCounter++,
        })
      );
      acksPublished.add(1);
    }, 3000);

    socket.setTimeout(function () {
      socket.close();
    }, 4000);
  });

  check(wsRes, {
    "mqtt websocket connected": (r) => r && r.status === 101,
  });

  sleep(1);

  const getRes = http.get(`${BASE_URL}/campaigns/${createdCampaign.id}`, {
    tags: { name: "full-flow: GET /campaigns/:id" },
  });

  check(getRes, {
    "campaign retrievable": (r) => r.status === 200,
  });

  sleep(0.5);

  const cancelRes = http.post(
    `${BASE_URL}/campaigns/${createdCampaign.id}/cancel`,
    null,
    { tags: { name: "full-flow: POST /campaigns/:id/cancel" } }
  );

  check(cancelRes, {
    "campaign cancelled": (r) => r.status === 200,
  });

  fullFlowDuration.add(Date.now() - flowStart);

  sleep(1);
}
