import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.K6_API_BASE_URL || "http://localhost:3000";

function buildCampaignPayload() {
  const now = Date.now();
  return JSON.stringify({
    name: `load-test-campaign-${uuidv4().slice(0, 8)}`,
    startAt: now + 60_000,
    expireAt: now + 86_400_000,
    assets: [
      {
        assetType: "image",
        url: "https://picsum.photos/1920/1080",
        durationMs: 10000,
      },
    ],
    metadata: { source: "k6-load-test", vuId: __VU, iteration: __ITER },
    idempotencyKey: uuidv4(),
  });
}

const headers = { "Content-Type": "application/json" };

export default function () {
  const createRes = http.post(`${BASE_URL}/campaigns`, buildCampaignPayload(), {
    headers,
    tags: { name: "POST /campaigns" },
  });

  check(createRes, {
    "create returns 201": (r) => r.status === 201,
    "create has id": (r) => {
      try {
        return JSON.parse(r.body as string).id !== undefined;
      } catch {
        return false;
      }
    },
  });

  const campaignId =
    createRes.status === 201
      ? JSON.parse(createRes.body as string).id
      : null;

  sleep(0.3);

  const listRes = http.get(`${BASE_URL}/campaigns?limit=10&offset=0`, {
    tags: { name: "GET /campaigns" },
  });

  check(listRes, {
    "list returns 200": (r) => r.status === 200,
    "list has data array": (r) => {
      try {
        return Array.isArray(JSON.parse(r.body as string).data);
      } catch {
        return false;
      }
    },
  });

  sleep(0.3);

  if (campaignId) {
    const getRes = http.get(`${BASE_URL}/campaigns/${campaignId}`, {
      tags: { name: "GET /campaigns/:id" },
    });

    check(getRes, {
      "get by id returns 200": (r) => r.status === 200,
      "get by id has correct id": (r) => {
        try {
          return JSON.parse(r.body as string).id === campaignId;
        } catch {
          return false;
        }
      },
    });

    sleep(0.3);

    const cancelRes = http.post(
      `${BASE_URL}/campaigns/${campaignId}/cancel`,
      null,
      { tags: { name: "POST /campaigns/:id/cancel" } }
    );

    check(cancelRes, {
      "cancel returns 200": (r) => r.status === 200,
    });
  }

  sleep(0.5);
}
