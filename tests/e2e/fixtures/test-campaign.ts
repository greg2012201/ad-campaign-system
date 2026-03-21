import { randomUUID } from "crypto";

type AssetInput = {
  assetType: "image" | "video" | "html";
  url: string;
  durationMs?: number;
};

type CampaignInput = {
  name: string;
  startAt: number;
  expireAt: number;
  assets: AssetInput[];
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
};

type CampaignFactoryOptions = {
  name?: string;
  startAt?: number;
  expireAt?: number;
  assets?: AssetInput[];
  metadata?: Record<string, unknown>;
};

function createTestCampaign(options: CampaignFactoryOptions = {}) {
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  return {
    name: options.name ?? `Test Campaign ${randomUUID().slice(0, 8)}`,
    startAt: options.startAt ?? now + oneHourMs,
    expireAt: options.expireAt ?? now + 24 * oneHourMs,
    assets: options.assets ?? [
      {
        assetType: "image" as const,
        url: "https://picsum.photos/1920/1080",
        durationMs: 10000,
      },
    ],
    metadata: options.metadata ?? { source: "e2e-test" },
    idempotencyKey: randomUUID(),
  } satisfies CampaignInput;
}

function createTestCampaignWithMultipleAssets(
  options: CampaignFactoryOptions = {},
) {
  return createTestCampaign({
    ...options,
    assets: options.assets ?? [
      {
        assetType: "image",
        url: "https://picsum.photos/1920/1080",
        durationMs: 5000,
      },
      {
        assetType: "video",
        url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
        durationMs: 10000,
      },
      {
        assetType: "html",
        url: "https://example.com/widget.html",
        durationMs: 8000,
      },
    ],
  });
}

function formatDateForInput(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export {
  createTestCampaign,
  createTestCampaignWithMultipleAssets,
  formatDateForInput,
};
export type { CampaignInput, AssetInput, CampaignFactoryOptions };
