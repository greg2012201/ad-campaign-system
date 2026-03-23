import type { MqttClient } from "mqtt";
import {
  TOPICS,
  EVENT_TYPES,
  type InstallAck,
  type DisplayStart,
  type DisplayComplete,
  type RevokeAck,
} from "@campaign-system/shared";

type AckEventParams = {
  client: MqttClient;
  deviceId: string;
  campaignId: string;
  version: number;
};

type RevokeAckParams = {
  client: MqttClient;
  deviceId: string;
  campaignId: string;
  version: number;
};

function publishInstallAck({
  client,
  deviceId,
  campaignId,
  version,
}: AckEventParams) {
  const event: InstallAck = {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.INSTALL_ACK,
    deviceId,
    campaignId,
    version,
    timestamp: Date.now(),
  };
  client.publish(TOPICS.ACKS(deviceId), JSON.stringify(event), { qos: 1 });
}

function publishDisplayStart({
  client,
  deviceId,
  campaignId,
  version,
}: AckEventParams) {
  const event: DisplayStart = {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.DISPLAY_START,
    deviceId,
    campaignId,
    version,
    timestamp: Date.now(),
  };
  client.publish(TOPICS.ACKS(deviceId), JSON.stringify(event), { qos: 1 });
}

function publishDisplayComplete({
  client,
  deviceId,
  campaignId,
  version,
}: AckEventParams) {
  const event: DisplayComplete = {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.DISPLAY_COMPLETE,
    deviceId,
    campaignId,
    version,
    timestamp: Date.now(),
  };
  client.publish(TOPICS.ACKS(deviceId), JSON.stringify(event), { qos: 1 });
}

function publishRevokeAck({ client, deviceId, campaignId, version }: RevokeAckParams) {
  const event: RevokeAck = {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.REVOKE_ACK,
    deviceId,
    campaignId,
    version,
    timestamp: Date.now(),
  };
  client.publish(TOPICS.ACKS(deviceId), JSON.stringify(event), { qos: 1 });
}

export {
  publishInstallAck,
  publishDisplayStart,
  publishDisplayComplete,
  publishRevokeAck,
};
export type { AckEventParams, RevokeAckParams };
