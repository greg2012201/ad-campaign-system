import { test, expect } from "@playwright/test";
import {
  MqttTestHelper,
  createManifestPayload,
  createControlPayload,
} from "../helpers/mqtt-helper";

const SCREEN_URL = process.env["E2E_SCREEN_URL"] || "http://localhost:5174";
const MQTT_TCP_URL = process.env["E2E_MQTT_TCP_URL"] || "mqtt://localhost:1883";
const MQTT_WS_URL = process.env["E2E_MQTT_WS_URL"] || "ws://localhost:9001";
const DEVICE_ID = "dev-001";
const CAMPAIGN_ID = "e2e-screen-campaign-001";
const TEMPLATE_HTML =
  "<html><body><h1 data-testid='campaign-content'>Test Campaign Active</h1></body></html>";

test.describe("screen client e2e", () => {
  let mqttHelper: MqttTestHelper;
  const acksTopic = `devices/${DEVICE_ID}/acks`;
  const notificationsTopic = `devices/${DEVICE_ID}/notifications`;
  const controlTopic = `devices/${DEVICE_ID}/control`;

  test.beforeAll(async () => {
    mqttHelper = new MqttTestHelper(MQTT_TCP_URL);
    await mqttHelper.connect();
    await mqttHelper.subscribe(acksTopic);
  });

  test.afterAll(async () => {
    await mqttHelper.disconnect();
  });

  test.beforeEach(async () => {
    mqttHelper.clearMessages();
  });

  test("displays campaign when manifest is published and sends INSTALL_ACK + DISPLAY_START", async ({
    page,
  }) => {
    await page.route("**/test-template.html", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: TEMPLATE_HTML,
      });
    });

    const screenUrl = `${SCREEN_URL}/?deviceId=${DEVICE_ID}&brokerUrl=${encodeURIComponent(MQTT_WS_URL)}`;
    await page.goto(screenUrl);
    await page.locator("#display").waitFor({ state: "attached" });
    await page.waitForTimeout(1000);

    const manifestPayload = createManifestPayload({
      campaignId: CAMPAIGN_ID,
      templateUrl: `${SCREEN_URL}/test-template.html`,
      version: 1,
      startAt: Date.now() - 5000,
      expireAt: Date.now() + 300_000,
      assets: [
        {
          url: `${SCREEN_URL}/test-asset.png`,
          checksum: "abc123",
          sizeBytes: 1024,
        },
      ],
    });

    await mqttHelper.publish({
      topic: notificationsTopic,
      payload: manifestPayload,
    });

    const installAck = await mqttHelper.waitForMessage({
      timeout: 15_000,
      filter: (_topic, payload) =>
        payload.eventType === "INSTALL_ACK" &&
        payload.campaignId === CAMPAIGN_ID,
    });

    const installPayload = JSON.parse(installAck.payload);
    expect(installPayload.eventType).toBe("INSTALL_ACK");
    expect(installPayload.campaignId).toBe(CAMPAIGN_ID);
    expect(installPayload.deviceId).toBe(DEVICE_ID);
    expect(installPayload.version).toBe(1);
    expect(installPayload.eventId).toBeTruthy();
    expect(installPayload.timestamp).toBeGreaterThan(0);

    const displayStart = await mqttHelper.waitForMessage({
      timeout: 15_000,
      filter: (_topic, payload) =>
        payload.eventType === "DISPLAY_START" &&
        payload.campaignId === CAMPAIGN_ID,
    });

    const displayPayload = JSON.parse(displayStart.payload);
    expect(displayPayload.eventType).toBe("DISPLAY_START");
    expect(displayPayload.campaignId).toBe(CAMPAIGN_ID);
    expect(displayPayload.deviceId).toBe(DEVICE_ID);
    expect(displayPayload.version).toBe(1);

    const iframe = page.locator("#display iframe");
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    const iframeElement = await iframe.elementHandle();
    const frame = await iframeElement?.contentFrame();
    expect(frame).toBeTruthy();
  });

  test("stops display and sends REVOKE_ACK when campaign is revoked", async ({
    page,
  }) => {
    const revokeCampaignId = "e2e-screen-campaign-revoke";

    await page.route("**/test-template-revoke.html", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<html><body><h1>Revoke Test Campaign</h1></body></html>",
      });
    });

    const screenUrl = `${SCREEN_URL}/?deviceId=${DEVICE_ID}&brokerUrl=${encodeURIComponent(MQTT_WS_URL)}`;
    await page.goto(screenUrl);
    await page.locator("#display").waitFor({ state: "attached" });
    await page.waitForTimeout(1000);

    const manifestPayload = createManifestPayload({
      campaignId: revokeCampaignId,
      templateUrl: `${SCREEN_URL}/test-template-revoke.html`,
      version: 1,
      startAt: Date.now() - 5000,
      expireAt: Date.now() + 300_000,
    });

    await mqttHelper.publish({
      topic: notificationsTopic,
      payload: manifestPayload,
    });

    await mqttHelper.waitForMessage({
      timeout: 15_000,
      filter: (_topic, payload) =>
        payload.eventType === "DISPLAY_START" &&
        payload.campaignId === revokeCampaignId,
    });

    const iframe = page.locator("#display iframe");
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    mqttHelper.clearMessages();

    const revokePayload = createControlPayload({
      type: "revoke",
      campaignId: revokeCampaignId,
    });

    await mqttHelper.publish({
      topic: controlTopic,
      payload: revokePayload,
    });

    const revokeAck = await mqttHelper.waitForMessage({
      timeout: 15_000,
      filter: (_topic, payload) =>
        payload.eventType === "REVOKE_ACK" &&
        payload.campaignId === revokeCampaignId,
    });

    const revokePayloadParsed = JSON.parse(revokeAck.payload);
    expect(revokePayloadParsed.eventType).toBe("REVOKE_ACK");
    expect(revokePayloadParsed.campaignId).toBe(revokeCampaignId);
    expect(revokePayloadParsed.deviceId).toBe(DEVICE_ID);
    expect(revokePayloadParsed.eventId).toBeTruthy();
    expect(revokePayloadParsed.timestamp).toBeGreaterThan(0);

    await expect(iframe).toBeHidden({ timeout: 10_000 });
  });

  test("sends DISPLAY_COMPLETE when campaign expires naturally", async ({
    page,
  }) => {
    const expireCampaignId = "e2e-screen-campaign-expire";

    await page.route("**/test-template-expire.html", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<html><body><h1>Expire Test Campaign</h1></body></html>",
      });
    });

    const screenUrl = `${SCREEN_URL}/?deviceId=${DEVICE_ID}&brokerUrl=${encodeURIComponent(MQTT_WS_URL)}`;
    await page.goto(screenUrl);
    await page.locator("#display").waitFor({ state: "attached" });
    await page.waitForTimeout(1000);

    const manifestPayload = createManifestPayload({
      campaignId: expireCampaignId,
      templateUrl: `${SCREEN_URL}/test-template-expire.html`,
      version: 1,
      startAt: Date.now() - 5000,
      expireAt: Date.now() + 5000,
    });

    await mqttHelper.publish({
      topic: notificationsTopic,
      payload: manifestPayload,
    });

    await mqttHelper.waitForMessage({
      timeout: 15_000,
      filter: (_topic, payload) =>
        payload.eventType === "DISPLAY_START" &&
        payload.campaignId === expireCampaignId,
    });

    const iframe = page.locator("#display iframe");
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    const displayComplete = await mqttHelper.waitForMessage({
      timeout: 20_000,
      filter: (_topic, payload) =>
        payload.eventType === "DISPLAY_COMPLETE" &&
        payload.campaignId === expireCampaignId,
    });

    const completePayload = JSON.parse(displayComplete.payload);
    expect(completePayload.eventType).toBe("DISPLAY_COMPLETE");
    expect(completePayload.campaignId).toBe(expireCampaignId);
    expect(completePayload.deviceId).toBe(DEVICE_ID);
    expect(completePayload.version).toBe(1);

    await expect(iframe).toBeHidden({ timeout: 10_000 });
  });

  test("ignores duplicate manifest with same or lower version", async ({
    page,
  }) => {
    const dupCampaignId = "e2e-screen-campaign-dup";

    await page.route("**/test-template-dup.html", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<html><body><h1>Duplicate Test</h1></body></html>",
      });
    });

    const screenUrl = `${SCREEN_URL}/?deviceId=${DEVICE_ID}&brokerUrl=${encodeURIComponent(MQTT_WS_URL)}`;
    await page.goto(screenUrl);
    await page.locator("#display").waitFor({ state: "attached" });
    await page.waitForTimeout(1000);

    const manifestPayload = createManifestPayload({
      campaignId: dupCampaignId,
      templateUrl: `${SCREEN_URL}/test-template-dup.html`,
      version: 1,
      startAt: Date.now() - 5000,
      expireAt: Date.now() + 300_000,
    });

    await mqttHelper.publish({
      topic: notificationsTopic,
      payload: manifestPayload,
    });

    await mqttHelper.waitForMessage({
      timeout: 15_000,
      filter: (_topic, payload) =>
        payload.eventType === "INSTALL_ACK" &&
        payload.campaignId === dupCampaignId,
    });

    mqttHelper.clearMessages();

    await mqttHelper.publish({
      topic: notificationsTopic,
      payload: manifestPayload,
    });

    await page.waitForTimeout(3000);

    const duplicateAcks = mqttHelper
      .getMessagesForTopic(acksTopic)
      .filter((m) => {
        try {
          const p = JSON.parse(m.payload);
          return (
            p.eventType === "INSTALL_ACK" && p.campaignId === dupCampaignId
          );
        } catch {
          return false;
        }
      });

    expect(duplicateAcks.length).toBe(0);
  });
});
