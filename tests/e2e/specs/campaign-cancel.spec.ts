import { test, expect } from "@playwright/test";
import { createTestCampaign } from "../fixtures/test-campaign";
import { MqttTestHelper } from "../helpers/mqtt-helper";

const API_URL = process.env["E2E_API_URL"] || "http://localhost:3100";
const MQTT_URL = process.env["E2E_MQTT_WS_URL"] || "ws://localhost:9001";

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

test.describe("campaign cancellation", () => {
  test("cancels a draft campaign via API", async ({ request }) => {
    const campaignData = createTestCampaign({ name: "Cancel Draft Test" });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    expect(createResponse.status()).toBe(201);
    const campaign = await createResponse.json();
    expect(campaign.status).toBe("draft");

    const cancelResponse = await request.post(
      `${API_URL}/campaigns/${campaign.id}/cancel`,
    );
    expect(cancelResponse.ok()).toBeTruthy();

    const cancelled = await cancelResponse.json();
    expect(cancelled.status).toBe("cancelled");

    const getResponse = await request.get(
      `${API_URL}/campaigns/${campaign.id}`,
    );
    const fetched = await getResponse.json();
    expect(fetched.status).toBe("cancelled");
  });

  test("cancels an active campaign and verifies status", async ({
    request,
  }) => {
    const campaignData = createTestCampaign({
      name: "Cancel Active Test",
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

    const cancelResponse = await request.post(
      `${API_URL}/campaigns/${campaign.id}/cancel`,
    );
    expect(cancelResponse.ok()).toBeTruthy();

    const cancelled = await cancelResponse.json();
    expect(cancelled.status).toBe("cancelled");
  });

  test("cancelling an active campaign sends revoke messages via MQTT", async ({
    request,
  }) => {
    const mqttHelper = new MqttTestHelper(MQTT_URL);
    await mqttHelper.connect();
    await mqttHelper.subscribe("devices/+/control");

    const campaignData = createTestCampaign({
      name: "Revoke MQTT Test",
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

    mqttHelper.clearMessages();

    await request.post(`${API_URL}/campaigns/${campaign.id}/cancel`);

    const messages = await mqttHelper.waitForMessages({
      count: 10,
      timeout: 30000,
      filter: (_topic, payload) =>
        payload.type === "revoke" && payload.campaignId === campaign.id,
    });

    expect(messages.length).toBe(10);

    for (const msg of messages) {
      const payload = JSON.parse(msg.payload);
      expect(payload.type).toBe("revoke");
      expect(payload.campaignId).toBe(campaign.id);
      expect(msg.topic).toMatch(/^devices\/[^/]+\/control$/);
    }

    const controlTopics = new Set(messages.map((m) => m.topic));
    expect(controlTopics.size).toBe(10);

    await mqttHelper.disconnect();
  });

  test("revoke message contains correct campaign ID", async ({ request }) => {
    const mqttHelper = new MqttTestHelper(MQTT_URL);
    await mqttHelper.connect();
    await mqttHelper.subscribe("devices/dev-001/control");

    const campaignData = createTestCampaign({
      name: "Revoke Payload Test",
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

    mqttHelper.clearMessages();

    await request.post(`${API_URL}/campaigns/${campaign.id}/cancel`);

    const message = await mqttHelper.waitForMessage({
      timeout: 30000,
      filter: (_topic, payload) =>
        payload.type === "revoke" && payload.campaignId === campaign.id,
    });

    const payload = JSON.parse(message.payload);
    expect(payload).toEqual({
      type: "revoke",
      campaignId: campaign.id,
    });

    await mqttHelper.disconnect();
  });

  test("returns 404 when cancelling non-existent campaign", async ({
    request,
  }) => {
    const response = await request.post(
      `${API_URL}/campaigns/00000000-0000-0000-0000-000000000000/cancel`,
    );
    expect(response.status()).toBe(404);
  });

  test("cancelled campaigns appear with cancelled status in the list", async ({
    request,
  }) => {
    const campaignData = createTestCampaign({
      name: "Cancelled List Filter Test",
    });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const campaign = await createResponse.json();

    await request.post(`${API_URL}/campaigns/${campaign.id}/cancel`);

    const listResponse = await request.get(
      `${API_URL}/campaigns?status=cancelled`,
    );
    expect(listResponse.ok()).toBeTruthy();

    const listBody = await listResponse.json();
    const found = listBody.data.find(
      (c: Record<string, unknown>) => c.id === campaign.id,
    );
    expect(found).toBeTruthy();
    expect(found.status).toBe("cancelled");
  });
});
