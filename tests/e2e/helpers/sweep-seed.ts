import pg from "pg";
import { randomUUID } from "crypto";

type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

type SeedDevicesParams = {
  dbConfig: DbConfig;
  count: number;
};

type CreateCampaignsParams = {
  apiBaseUrl: string;
  count: number;
  assetsPerCampaign: number;
};

type CleanupParams = {
  dbConfig: DbConfig;
  campaignIds: string[];
};

type SweepCampaign = {
  id: string;
  name: string;
  status: string;
  idempotencyKey: string;
};

const ASSET_TYPES = ["image", "video", "html"] as const;

const ASSET_URLS: Record<string, string> = {
  image: "https://picsum.photos/1920/1080",
  video: "https://example.com/sample-video.mp4",
  html: "https://example.com/sample-widget.html",
};

async function seedSweepDevices({ dbConfig, count }: SeedDevicesParams) {
  const client = new pg.Client(dbConfig);
  await client.connect();

  const deviceIds: string[] = [];

  for (let i = 1; i <= count; i++) {
    const deviceId = `sweep-dev-${String(i).padStart(3, "0")}`;
    deviceIds.push(deviceId);

    await client.query(
      `INSERT INTO devices ("deviceId", "groupId", "status", "metadata")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("deviceId") DO NOTHING`,
      [
        deviceId,
        "sweep-test",
        "offline",
        JSON.stringify({ source: "sweep-test" }),
      ],
    );
  }

  await client.end();
  return deviceIds;
}

async function createSweepCampaigns({
  apiBaseUrl,
  count,
  assetsPerCampaign,
}: CreateCampaignsParams) {
  const campaigns: SweepCampaign[] = [];

  for (let i = 0; i < count; i++) {
    const assets = Array.from({ length: assetsPerCampaign }, (_, j) => {
      const assetType = ASSET_TYPES[j % ASSET_TYPES.length] as
        (typeof ASSET_TYPES)[number];
      return {
        assetType,
        url: ASSET_URLS[assetType],
        durationMs: 10_000,
      };
    });

    const idempotencyKey = randomUUID();

    const response = await fetch(`${apiBaseUrl}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `sweep-campaign-${String(i + 1).padStart(3, "0")}`,
        startAt: Date.now() + 60_000,
        expireAt: Date.now() + 86_400_000,
        assets,
        metadata: { source: "sweep-test", index: i },
        idempotencyKey,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to create campaign ${i + 1}: ${response.status} ${text}`,
      );
    }

    const campaign = (await response.json()) as SweepCampaign;
    campaigns.push(campaign);
  }

  return campaigns;
}

async function cleanupSweepData({ dbConfig, campaignIds }: CleanupParams) {
  const client = new pg.Client(dbConfig);
  await client.connect();

  await client.query(
    `DELETE FROM delivery_events WHERE "deviceId" LIKE 'sweep-dev-%'`,
  );

  if (campaignIds.length > 0) {
    await client.query(
      `DELETE FROM campaign_assets WHERE "campaignId" = ANY($1)`,
      [campaignIds],
    );
    await client.query(`DELETE FROM campaigns WHERE id = ANY($1)`, [
      campaignIds,
    ]);
  }

  await client.query(
    `DELETE FROM devices WHERE "deviceId" LIKE 'sweep-dev-%'`,
  );

  await client.end();
}

export { seedSweepDevices, createSweepCampaigns, cleanupSweepData };
export type { SweepCampaign, DbConfig };
