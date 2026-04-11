import { test, expect } from "@playwright/test";
import pg from "pg";
import { config } from "dotenv";
import path from "path";
import { getProfile } from "../helpers/sweep-profiles";
import {
  seedSweepDevices,
  createSweepCampaigns,
  cleanupSweepData,
} from "../helpers/sweep-seed";
import {
  MqttTestHelper,
  createAckPayload,
} from "../helpers/mqtt-helper";
import type { SweepCampaign, DbConfig } from "../helpers/sweep-seed";

const ENV_TEST_PATH = path.resolve(
  import.meta.dirname,
  "../../../.env.test",
);

config({ path: ENV_TEST_PATH });

const API_URL =
  process.env["E2E_API_URL"] ||
  `http://localhost:${process.env["API_PORT"] || 3100}`;

const MQTT_BROKER_URL =
  process.env["MQTT_BROKER_URL"] || "mqtt://localhost:1883";

const profile = getProfile();

let deviceIds: string[];
let campaigns: SweepCampaign[];
let mqttHelper: MqttTestHelper;
let dbConfig: DbConfig;

test.describe(`@sweep full-system integration sweep (${profile.name})`, () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(profile.timeoutMs);

  test.beforeAll(async () => {
    dbConfig = {
      host: process.env["POSTGRES_HOST"] || "localhost",
      port: Number(process.env["POSTGRES_PORT"] || 5432),
      user: process.env["POSTGRES_USER"] || "test",
      password: process.env["POSTGRES_PASSWORD"] || "test",
      database: process.env["POSTGRES_DB"] || "campaign_test",
    };

    mqttHelper = new MqttTestHelper(MQTT_BROKER_URL);
    await mqttHelper.connect();
    await mqttHelper.subscribe("devices/+/notifications");
    await mqttHelper.subscribe("devices/+/control");

    deviceIds = await seedSweepDevices({
      dbConfig,
      count: profile.deviceCount,
    });

    campaigns = await createSweepCampaigns({
      apiBaseUrl: API_URL,
      count: profile.campaignCount,
      assetsPerCampaign: profile.assetsPerCampaign,
    });
  });

  test.afterAll(async () => {
    await mqttHelper?.disconnect();
    await cleanupSweepData({
      dbConfig,
      campaignIds: campaigns?.map((c) => c.id) ?? [],
    });
  });

  test("campaigns progress through all statuses", async ({ request }) => {
    const validStatuses = [
      "draft",
      "building",
      "ready",
      "publishing",
      "active",
    ];
    const activeCampaigns = new Set<string>();
    const start = Date.now();
    const pollTimeout = profile.timeoutMs - 5_000;

    while (
      activeCampaigns.size < campaigns.length &&
      Date.now() - start < pollTimeout
    ) {
      for (const campaign of campaigns) {
        if (activeCampaigns.has(campaign.id)) continue;

        const response = await request.get(
          `${API_URL}/campaigns/${campaign.id}`,
        );
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(validStatuses).toContain(data.status);

        if (data.status === "active") {
          activeCampaigns.add(campaign.id);
        }
      }

      if (activeCampaigns.size < campaigns.length) {
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }

    expect(activeCampaigns.size).toBe(campaigns.length);
  });

  test("every device receives MQTT manifests", async () => {
    const expectedCount = deviceIds.length * campaigns.length;
    const campaignIdSet = new Set(campaigns.map((c) => c.id));

    await mqttHelper.waitForMessages({
      count: expectedCount,
      timeout: profile.timeoutMs - 5_000,
      filter: (topic: string, payload: Record<string, unknown>) =>
        topic.includes("sweep-dev-") &&
        topic.endsWith("/notifications") &&
        campaignIdSet.has(payload.campaignId as string),
    });

    const allMessages = mqttHelper.getMessages();

    for (const deviceId of deviceIds) {
      for (const campaign of campaigns) {
        const matching = allMessages.filter((m) => {
          try {
            const p = JSON.parse(m.payload) as Record<string, unknown>;
            return (
              m.topic === `devices/${deviceId}/notifications` &&
              p.campaignId === campaign.id
            );
          } catch {
            return false;
          }
        });

        expect(matching.length).toBeGreaterThanOrEqual(1);

        const manifest = JSON.parse(matching[0]!.payload) as Record<
          string,
          unknown
        >;
        expect(manifest.campaignId).toBe(campaign.id);
        expect(manifest).toHaveProperty("templateUrl");
        expect(manifest).toHaveProperty("startAt");
        expect(manifest).toHaveProperty("expireAt");
        expect(manifest).toHaveProperty("assets");
      }
    }
  });

  test("template HTML is served for every campaign", async ({ request }) => {
    for (const campaign of campaigns) {
      const response = await request.get(
        `${API_URL}/templates/${campaign.id}/index.html`,
      );
      expect(response.ok()).toBeTruthy();

      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
    }
  });

  test("ack events are persisted idempotently", async () => {
    type AckRecord = {
      eventId: string;
      deviceId: string;
      campaignId: string;
      eventType: string;
    };

    const ackRecords: AckRecord[] = [];
    const eventTypes = [
      "INSTALL_ACK",
      "DISPLAY_START",
      "DISPLAY_COMPLETE",
    ] as const;

    for (const deviceId of deviceIds) {
      for (const campaign of campaigns) {
        for (const eventType of eventTypes) {
          const ackPayload = createAckPayload({
            eventType,
            deviceId,
            campaignId: campaign.id,
            version: 1,
          });

          const parsed = JSON.parse(ackPayload) as Record<string, unknown>;
          ackRecords.push({
            eventId: parsed.eventId as string,
            deviceId,
            campaignId: campaign.id,
            eventType,
          });

          await mqttHelper.publish({
            topic: `devices/${deviceId}/acks`,
            payload: ackPayload,
          });
        }
      }
    }

    await new Promise((r) => setTimeout(r, 5_000));

    const client = new pg.Client(dbConfig);
    await client.connect();

    const { rows } = await client.query(
      `SELECT * FROM delivery_events WHERE "device_id" LIKE 'sweep-dev-%'`,
    );

    const expectedCount =
      deviceIds.length * campaigns.length * eventTypes.length;
    expect(rows.length).toBe(expectedCount);

    const firstAck = ackRecords[0]!;
    await mqttHelper.publish({
      topic: `devices/${firstAck.deviceId}/acks`,
      payload: JSON.stringify({
        eventId: firstAck.eventId,
        eventType: firstAck.eventType,
        deviceId: firstAck.deviceId,
        campaignId: firstAck.campaignId,
        version: 1,
        timestamp: Date.now(),
      }),
    });

    await new Promise((r) => setTimeout(r, 2_000));

    const { rows: rowsAfterDuplicate } = await client.query(
      `SELECT * FROM delivery_events WHERE "device_id" LIKE 'sweep-dev-%'`,
    );

    expect(rowsAfterDuplicate.length).toBe(expectedCount);

    await client.end();
  });

  test("device lastSeen is updated", async () => {
    const client = new pg.Client(dbConfig);
    await client.connect();

    const { rows } = await client.query(
      `SELECT "device_id", "last_seen" FROM devices WHERE "device_id" LIKE 'sweep-dev-%'`,
    );

    expect(rows.length).toBe(deviceIds.length);

    for (const row of rows) {
      expect(row.last_seen).not.toBeNull();
    }

    await client.end();
  });

  test("cancel propagates revoke to all devices", async ({ request }) => {
    mqttHelper.clearMessages();

    const campaignToCancel = campaigns[0]!;

    const cancelResponse = await request.post(
      `${API_URL}/campaigns/${campaignToCancel.id}/cancel`,
    );
    expect(cancelResponse.ok()).toBeTruthy();

    const cancelledCampaign = await cancelResponse.json();
    expect(cancelledCampaign.status).toBe("cancelled");

    const deviceIdSet = new Set(deviceIds);

    await mqttHelper.waitForMessages({
      count: deviceIds.length,
      timeout: 30_000,
      filter: (topic: string, payload: Record<string, unknown>) => {
        const parts = topic.split("/");
        return (
          parts[0] === "devices" &&
          parts[2] === "control" &&
          deviceIdSet.has(parts[1]!) &&
          payload.type === "revoke" &&
          payload.campaignId === campaignToCancel.id
        );
      },
    });

    const revokeMessages = mqttHelper.getMessages();

    for (const deviceId of deviceIds) {
      const matching = revokeMessages.filter((m) => {
        try {
          const p = JSON.parse(m.payload) as Record<string, unknown>;
          return (
            m.topic === `devices/${deviceId}/control` &&
            p.type === "revoke" &&
            p.campaignId === campaignToCancel.id
          );
        } catch {
          return false;
        }
      });

      expect(matching.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("screen client renders and stops on revoke", async ({ page }) => {
    test.skip(
      profile.name !== "large",
      "Screen client test only runs on large profile",
    );
    test.skip(
      campaigns.length < 2,
      "Need at least 2 campaigns for screen client test after cancel",
    );

    const screenClientUrl =
      process.env["E2E_SCREEN_URL"] || "http://localhost:5173";
    const deviceId = deviceIds[0]!;
    const activeCampaign = campaigns.find(
      (c) => c.id !== campaigns[0]!.id,
    )!;

    let screenAvailable = false;
    try {
      const healthCheck = await fetch(screenClientUrl);
      screenAvailable = healthCheck.ok;
    } catch {
      screenAvailable = false;
    }

    test.skip(!screenAvailable, "Screen client not reachable");

    await page.goto(`${screenClientUrl}?deviceId=${deviceId}`);

    const iframe = page.locator("iframe");
    await expect(iframe).toBeVisible({ timeout: 30_000 });

    const src = await iframe.getAttribute("src");
    expect(src).toContain("/templates/");

    mqttHelper.clearMessages();

    await mqttHelper.publish({
      topic: `devices/${deviceId}/control`,
      payload: JSON.stringify({
        type: "revoke",
        campaignId: activeCampaign.id,
      }),
    });

    await page.waitForTimeout(5_000);

    const revokedIframe = page.locator(
      `iframe[src*="${activeCampaign.id}"]`,
    );
    await expect(revokedIframe).not.toBeVisible({ timeout: 10_000 });
  });
});
