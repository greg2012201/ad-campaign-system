import { createHash } from "node:crypto";
import type { Manifest } from "@campaign-system/shared";
import { CampaignEntity } from "../campaigns/campaign.entity";

type BuildManifestParams = {
  campaign: CampaignEntity;
  apiBaseUrl: string;
};

function deriveManifestId({ campaignId, version }: { campaignId: string; version: number }) {
  const hash = createHash("sha256")
    .update(`${campaignId}:v${version}`)
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

export function buildManifest({ campaign, apiBaseUrl }: BuildManifestParams) {
  const manifest: Manifest = {
    manifestId: deriveManifestId({
      campaignId: campaign.id,
      version: campaign.version,
    }),
    campaignId: campaign.id,
    version: campaign.version,
    startAt: Number(campaign.startAt),
    expireAt: Number(campaign.expireAt),
    templateUrl: `${apiBaseUrl}/templates/${campaign.id}/index.html`,
    assets: campaign.assets.map((a) => ({
      url: a.url,
      checksum: a.checksum ?? "",
      sizeBytes: Number(a.sizeBytes ?? 0),
    })),
  };

  return manifest;
}
