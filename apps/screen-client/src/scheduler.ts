import type { Manifest } from "@campaign-system/shared";
import { getAllPendingCampaigns } from "./storage";
import {
  showCampaign,
  prefetchResources,
  stopDisplay,
  getCurrentCampaignId,
} from "./display";
import type { DisplayCallbacks } from "./display";

type InitSchedulerParams = {
  container: HTMLElement;
  callbacks: DisplayCallbacks;
};

const PREFETCH_LEAD_TIME = 5 * 60 * 1000;
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
const prefetchTimers = new Map<string, ReturnType<typeof setTimeout>>();
const prefetchedCampaigns = new Set<string>();
let safetyInterval: ReturnType<typeof setInterval> | null = null;
let displayContainer: HTMLElement | null = null;
let displayCallbacks: DisplayCallbacks | null = null;

function initScheduler({ container, callbacks }: InitSchedulerParams) {
  displayContainer = container;
  displayCallbacks = callbacks;

  safetyInterval = setInterval(() => {
    checkAndSchedule();
  }, 30_000);
}

async function checkAndSchedule() {
  if (!displayContainer || !displayCallbacks) return;

  const manifests = await getAllPendingCampaigns();
  const now = Date.now();

  for (const manifest of manifests) {
    if (scheduledTimers.has(manifest.campaignId)) continue;
    if (getCurrentCampaignId() === manifest.campaignId) continue;

    if (now >= manifest.expireAt) {
      continue;
    }

    if (now >= manifest.startAt && now < manifest.expireAt) {
      displayManifest(manifest);
    } else if (now < manifest.startAt) {
      schedulePrefetch(manifest, now);

      const delay = manifest.startAt - now;
      const timer = setTimeout(() => {
        scheduledTimers.delete(manifest.campaignId);
        displayManifest(manifest);
      }, delay);
      scheduledTimers.set(manifest.campaignId, timer);
    }
  }
}

function schedulePrefetch(manifest: Manifest, now: number) {
  if (prefetchedCampaigns.has(manifest.campaignId)) return;
  if (prefetchTimers.has(manifest.campaignId)) return;

  const prefetchAt = manifest.startAt - PREFETCH_LEAD_TIME;

  if (now >= prefetchAt) {
    prefetchedCampaigns.add(manifest.campaignId);
    prefetchResources(manifest);
    return;
  }

  const delay = prefetchAt - now;
  const timer = setTimeout(() => {
    prefetchTimers.delete(manifest.campaignId);
    prefetchedCampaigns.add(manifest.campaignId);
    prefetchResources(manifest);
  }, delay);
  prefetchTimers.set(manifest.campaignId, timer);
}

function displayManifest(manifest: Manifest) {
  if (!displayContainer || !displayCallbacks) return;

  showCampaign({
    manifest,
    container: displayContainer,
    callbacks: displayCallbacks,
  });
}

function cancelScheduled(campaignId: string) {
  const timer = scheduledTimers.get(campaignId);
  if (timer) {
    clearTimeout(timer);
    scheduledTimers.delete(campaignId);
  }

  const prefetchTimer = prefetchTimers.get(campaignId);
  if (prefetchTimer) {
    clearTimeout(prefetchTimer);
    prefetchTimers.delete(campaignId);
  }

  prefetchedCampaigns.delete(campaignId);

  if (getCurrentCampaignId() === campaignId) {
    stopDisplay();
  }
}

function destroyScheduler() {
  if (safetyInterval) {
    clearInterval(safetyInterval);
    safetyInterval = null;
  }

  for (const [, timer] of scheduledTimers) {
    clearTimeout(timer);
  }
  scheduledTimers.clear();

  for (const [, timer] of prefetchTimers) {
    clearTimeout(timer);
  }
  prefetchTimers.clear();
  prefetchedCampaigns.clear();

  stopDisplay();
}

export { initScheduler, checkAndSchedule, cancelScheduled, destroyScheduler };
