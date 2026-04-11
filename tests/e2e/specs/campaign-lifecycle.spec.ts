import { test, expect } from "@playwright/test";
import pg from "pg";
import { createTestCampaign } from "../fixtures/test-campaign";
import { MqttTestHelper, createAckPayload } from "../helpers/mqtt-helper";

const API_URL = process.env["E2E_API_URL"] || "http://localhost:3100";
const MQTT_URL = process.env["E2E_MQTT_WS_URL"] || "ws://localhost:9001";

function getDbConfig() {
  return {
    host: process.env["POSTGRES_HOST"] || "localhost",
    port: Number(process.env["POSTGRES_PORT"] || 5432),
    user: process.env["POSTGRES_USER"] || "test",
    password: process.env["POSTGRES_PASSWORD"] || "test",
    database: process.env["POSTGRES_DB"] || "campaign_test",
  };
}

async function pollCampaignStatus({
  campaignId,
  targetStatus,
  request,
  timeout = 60000,
}: {
  campaignId: string;
  targetStatus: string;
  request: { get: (url: string) => Promise<{ json: () => Promise<Record<string, unknown>> }> };
  timeout?: number;
}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const response = await request.get(`${API_URL}/campaigns/${campaignId}`);
    const campaign = await response.json();
    if (campaign.status === targetStatus) return campaign;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Campaign ${campaignId} did not reach status '${targetStatus}' within ${timeout}ms`,
  );
}

test.describe("campaign lifecycle", () => {
  test("campaign progresses from draft through building to ready", async ({
    request,
  }) => {
    const campaignData = createTestCampaign({ name: "Lifecycle Status Test" });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    expect(createResponse.status()).toBe(201);
    const campaign = await createResponse.json();
    expect(campaign.status).toBe("draft");

    const readyCampaign = await pollCampaignStatus({
      campaignId: campaign.id,
      targetStatus: "ready",
      request,
    });
    expect(readyCampaign.status).toBe("ready");
  });

  test("template HTML is generated and served for a ready campaign", async ({
    request,
  }) => {
    const campaignData = createTestCampaign({ name: "Template Build Test" });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const campaign = await createResponse.json();

    await pollCampaignStatus({
      campaignId: campaign.id,
      targetStatus: "ready",
      request,
    });

    const templateResponse = await request.get(
      `${API_URL}/templates/${campaign.id}/index.html`,
    );
    expect(templateResponse.ok()).toBeTruthy();

    const html = await templateResponse.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain(campaignData.assets[0]!.url);
  });

  test("campaign reaches active and MQTT manifest is published to devices", async ({
    request,
  }) => {
    const mqttHelper = new MqttTestHelper(MQTT_URL);
    await mqttHelper.connect();
    await mqttHelper.subscribe("devices/+/notifications");

    const campaignData = createTestCampaign({ name: "MQTT Manifest Test" });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const campaign = await createResponse.json();

    const activeCampaign = await pollCampaignStatus({
      campaignId: campaign.id,
      targetStatus: "active",
      request,
    });
    expect(activeCampaign.status).toBe("active");

    const message = await mqttHelper.waitForMessage({
      timeout: 30000,
      filter: (_topic, payload) => payload.campaignId === campaign.id,
    });

    const manifest = JSON.parse(message.payload);
    expect(manifest.campaignId).toBe(campaign.id);
    expect(manifest.version).toBe(1);
    expect(manifest.startAt).toBe(campaignData.startAt);
    expect(manifest.expireAt).toBe(campaignData.expireAt);
    expect(manifest.templateUrl).toContain(`/templates/${campaign.id}/index.html`);
    expect(manifest.assets).toHaveLength(campaignData.assets.length);
    expect(manifest.manifestId).toBeTruthy();

    expect(message.topic).toMatch(/^devices\/[^/]+\/notifications$/);

    await mqttHelper.disconnect();
  });

  test("MQTT manifest is delivered to multiple devices", async ({
    request,
  }) => {
    const mqttHelper = new MqttTestHelper(MQTT_URL);
    await mqttHelper.connect();
    await mqttHelper.subscribe("devices/+/notifications");

    const campaignData = createTestCampaign({
      name: "Multi-Device Manifest Test",
    });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const campaign = await createResponse.json();

    await pollCampaignStatus({
      campaignId: campaign.id,
      targetStatus: "active",
      request,
    });

    const messages = await mqttHelper.waitForMessages({
      count: 10,
      timeout: 30000,
      filter: (_topic, payload) => payload.campaignId === campaign.id,
    });

    expect(messages.length).toBe(10);

    const deviceTopics = new Set(messages.map((m) => m.topic));
    expect(deviceTopics.size).toBe(10);

    for (const msg of messages) {
      const manifest = JSON.parse(msg.payload);
      expect(manifest.campaignId).toBe(campaign.id);
    }

    await mqttHelper.disconnect();
  });

  test("ack events from devices are persisted in the database", async ({
    request,
  }) => {
    const mqttHelper = new MqttTestHelper(MQTT_URL);
    await mqttHelper.connect();

    const campaignData = createTestCampaign({ name: "Ack Persistence Test" });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const campaign = await createResponse.json();

    await pollCampaignStatus({
      campaignId: campaign.id,
      targetStatus: "active",
      request,
    });

    const deviceId = "dev-001";
    const ackPayload = createAckPayload({
      eventType: "INSTALL_ACK",
      deviceId,
      campaignId: campaign.id,
      version: 1,
    });

    await mqttHelper.publish({
      topic: `devices/${deviceId}/acks`,
      payload: ackPayload,
    });

    await new Promise((r) => setTimeout(r, 3000));

    const dbConfig = getDbConfig();
    const client = new pg.Client(dbConfig);
    await client.connect();

    const result = await client.query(
      `SELECT * FROM delivery_events WHERE "campaign_id" = $1 AND "device_id" = $2 AND "event_type" = $3`,
      [campaign.id, deviceId, "install_ack"],
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].device_id).toBe(deviceId);
    expect(result.rows[0].campaign_id).toBe(campaign.id);

    await client.end();
    await mqttHelper.disconnect();
  });

  test("ack events are idempotent - duplicates are ignored", async ({
    request,
  }) => {
    const mqttHelper = new MqttTestHelper(MQTT_URL);
    await mqttHelper.connect();

    const campaignData = createTestCampaign({ name: "Ack Idempotency Test" });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const campaign = await createResponse.json();

    await pollCampaignStatus({
      campaignId: campaign.id,
      targetStatus: "active",
      request,
    });

    const deviceId = "dev-002";
    const ackPayload = createAckPayload({
      eventType: "DISPLAY_START",
      deviceId,
      campaignId: campaign.id,
      version: 1,
    });

    await mqttHelper.publish({
      topic: `devices/${deviceId}/acks`,
      payload: ackPayload,
    });

    await mqttHelper.publish({
      topic: `devices/${deviceId}/acks`,
      payload: ackPayload,
    });

    await new Promise((r) => setTimeout(r, 3000));

    const dbConfig = getDbConfig();
    const client = new pg.Client(dbConfig);
    await client.connect();

    const result = await client.query(
      `SELECT * FROM delivery_events WHERE "campaign_id" = $1 AND "device_id" = $2 AND "event_type" = $3`,
      [campaign.id, deviceId, "display_start"],
    );

    expect(result.rows.length).toBe(1);

    await client.end();
    await mqttHelper.disconnect();
  });

  test("device lastSeen is updated after processing an ack", async ({
    request,
  }) => {
    const mqttHelper = new MqttTestHelper(MQTT_URL);
    await mqttHelper.connect();

    const campaignData = createTestCampaign({
      name: "Device LastSeen Test",
    });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const campaign = await createResponse.json();

    await pollCampaignStatus({
      campaignId: campaign.id,
      targetStatus: "active",
      request,
    });

    const deviceId = "dev-003";
    const beforeAck = new Date();

    const ackPayload = createAckPayload({
      eventType: "DISPLAY_COMPLETE",
      deviceId,
      campaignId: campaign.id,
      version: 1,
    });

    await mqttHelper.publish({
      topic: `devices/${deviceId}/acks`,
      payload: ackPayload,
    });

    await new Promise((r) => setTimeout(r, 3000));

    const dbConfig = getDbConfig();
    const client = new pg.Client(dbConfig);
    await client.connect();

    const result = await client.query(
      `SELECT "last_seen" FROM devices WHERE "device_id" = $1`,
      [deviceId],
    );

    expect(result.rows.length).toBe(1);
    const lastSeen = new Date(result.rows[0].last_seen);
    expect(lastSeen.getTime()).toBeGreaterThanOrEqual(beforeAck.getTime() - 1000);

    await client.end();
    await mqttHelper.disconnect();
  });
});
