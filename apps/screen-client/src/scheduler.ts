import type { Manifest } from "@campaign-system/shared";
import { getAllPendingCampaigns } from "./storage";
import { showCampaign, stopDisplay, getCurrentCampaignId } from "./display";
import type { DisplayCallbacks } from "./display";

type InitSchedulerParams = {
  container: HTMLElement;
  callbacks: DisplayCallbacks;
};

const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
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
      const delay = manifest.startAt - now;
      const timer = setTimeout(() => {
        scheduledTimers.delete(manifest.campaignId);
        displayManifest(manifest);
      }, delay);
      scheduledTimers.set(manifest.campaignId, timer);
    }
  }
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
  stopDisplay();
}

export { initScheduler, checkAndSchedule, cancelScheduled, destroyScheduler };
