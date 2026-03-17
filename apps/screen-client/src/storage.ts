import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { Manifest } from "@campaign-system/shared";

type CampaignDisplayState = {
  manifestId: string;
  campaignId: string;
  displayed: boolean;
  displayedAt: number | null;
};

interface ScreenClientDB extends DBSchema {
  manifests: {
    key: string;
    value: Manifest;
  };
  campaigns: {
    key: string;
    value: CampaignDisplayState;
  };
}

let db: IDBPDatabase<ScreenClientDB>;

async function initStorage() {
  db = await openDB<ScreenClientDB>("screen-client", 1, {
    upgrade(database) {
      database.createObjectStore("manifests", { keyPath: "manifestId" });
      database.createObjectStore("campaigns", { keyPath: "campaignId" });
    },
  });
}

async function saveManifest(manifest: Manifest) {
  await db.put("manifests", manifest);
  await db.put("campaigns", {
    manifestId: manifest.manifestId,
    campaignId: manifest.campaignId,
    displayed: false,
    displayedAt: null,
  });
}

async function getManifest(manifestId: string) {
  return db.get("manifests", manifestId);
}

async function getManifestByCampaign(campaignId: string) {
  const all = await db.getAll("manifests");
  return all.find((m) => m.campaignId === campaignId);
}

async function getAllPendingCampaigns() {
  return db.getAll("manifests");
}

async function markDisplayed(campaignId: string) {
  const state = await db.get("campaigns", campaignId);
  if (state) {
    await db.put("campaigns", {
      ...state,
      displayed: true,
      displayedAt: Date.now(),
    });
  }
}

async function deleteCampaign(campaignId: string) {
  const manifest = await getManifestByCampaign(campaignId);
  if (manifest) {
    await db.delete("manifests", manifest.manifestId);
  }
  await db.delete("campaigns", campaignId);
}

export {
  initStorage,
  saveManifest,
  getManifest,
  getManifestByCampaign,
  getAllPendingCampaigns,
  markDisplayed,
  deleteCampaign,
};
export type { CampaignDisplayState };
