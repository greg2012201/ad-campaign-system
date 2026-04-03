import type { Manifest } from "@campaign-system/shared";

type DisplayCallbacks = {
  onDisplayStart: (manifest: Manifest) => void;
  onDisplayComplete: (manifest: Manifest) => void;
};

type ShowCampaignParams = {
  manifest: Manifest;
  container: HTMLElement;
  callbacks: DisplayCallbacks;
};

const TEMPLATE_CACHE_NAME = "screen-client-templates";

let currentIframe: HTMLIFrameElement | null = null;
let currentCampaignId: string | null = null;
let displayTimeout: ReturnType<typeof setTimeout> | null = null;

async function fetchTemplate(templateUrl: string) {
  const cache = await caches.open(TEMPLATE_CACHE_NAME);
  const cached = await cache.match(templateUrl);
  if (cached) {
    return cached.text();
  }

  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch template: ${response.status} ${response.statusText}`,
    );
  }

  await cache.put(templateUrl, response.clone());
  return response.text();
}

async function showCampaign({
  manifest,
  container,
  callbacks,
}: ShowCampaignParams) {
  stopDisplay();

  const html = await fetchTemplate(manifest.templateUrl);

  const iframe = document.createElement("iframe");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.position = "absolute";
  iframe.style.top = "0";
  iframe.style.left = "0";

  container.appendChild(iframe);
  currentIframe = iframe;
  currentCampaignId = manifest.campaignId;

  const doc = iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  callbacks.onDisplayStart(manifest);

  const remainingMs = manifest.expireAt - Date.now();
  if (remainingMs > 0) {
    displayTimeout = setTimeout(() => {
      callbacks.onDisplayComplete(manifest);
      stopDisplay();
    }, remainingMs);
  } else {
    callbacks.onDisplayComplete(manifest);
    stopDisplay();
  }
}

function stopDisplay() {
  if (displayTimeout) {
    clearTimeout(displayTimeout);
    displayTimeout = null;
  }
  if (currentIframe) {
    currentIframe.remove();
    currentIframe = null;
  }
  currentCampaignId = null;
}

function getCurrentCampaignId() {
  return currentCampaignId;
}

async function prefetchResources(manifest: Manifest) {
  const cache = await caches.open(TEMPLATE_CACHE_NAME);
  const urls = [manifest.templateUrl, ...manifest.assets.map((a) => a.url)];

  await Promise.allSettled(
    urls.map(async (url) => {
      const cached = await cache.match(url);
      if (cached) return;

      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    }),
  );
}

export {
  fetchTemplate,
  prefetchResources,
  showCampaign,
  stopDisplay,
  getCurrentCampaignId,
};
export type { DisplayCallbacks, ShowCampaignParams };
