import type { MqttClient } from "mqtt";
import { TOPICS } from "@campaign-system/shared";
import type { Manifest } from "@campaign-system/shared";
import {
  initStorage,
  saveManifest,
  getManifestByCampaign,
  deleteCampaign,
} from "./storage";
import { connectMqtt } from "./mqtt-client";
import { fetchTemplate } from "./display";
import { initScheduler, checkAndSchedule, cancelScheduled } from "./scheduler";
import {
  publishInstallAck,
  publishDisplayStart,
  publishDisplayComplete,
  publishRevokeAck,
} from "./ack";

type ControlMessage = {
  type: string;
  campaignId: string;
};

type ClientContext = {
  client: MqttClient;
  deviceId: string;
};

function getDeviceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("deviceId") ?? "dev-001";
}

function getBrokerUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("brokerUrl") ?? "ws://localhost:9001";
}

async function handleManifest(
  manifest: Manifest,
  { client, deviceId }: ClientContext,
) {
  console.log(
    `[main] received manifest for campaign ${manifest.campaignId} v${manifest.version}`,
  );

  if (!manifest.manifestId || !manifest.campaignId || !manifest.templateUrl) {
    console.error("[main] invalid manifest: missing required fields");
    return;
  }

  const existing = await getManifestByCampaign(manifest.campaignId);
  if (existing && existing.version >= manifest.version) {
    console.log(
      `[main] campaign ${manifest.campaignId} already installed at v${existing.version}, skipping`,
    );
    return;
  }

  await saveManifest(manifest);

  try {
    await fetchTemplate(manifest.templateUrl);
  } catch (error) {
    console.error("[main] failed to prefetch template:", error);
  }

  publishInstallAck({
    client,
    deviceId,
    campaignId: manifest.campaignId,
    version: manifest.version,
  });

  await checkAndSchedule();
}

async function handleControl(
  message: ControlMessage,
  { client, deviceId }: ClientContext,
) {
  console.log(`[main] received control message: ${message.type}`);

  if (message.type === "revoke") {
    const manifest = await getManifestByCampaign(message.campaignId);
    cancelScheduled(message.campaignId);
    await deleteCampaign(message.campaignId);
    publishRevokeAck({
      client,
      deviceId,
      campaignId: message.campaignId,
      version: manifest?.version ?? 0,
    });
    console.log(`[main] revoked campaign ${message.campaignId}`);
  }
}

async function bootstrap() {
  const deviceId = getDeviceId();
  const brokerUrl = getBrokerUrl();

  console.log(`[main] starting screen client for device ${deviceId}`);
  console.log(`[main] connecting to broker at ${brokerUrl}`);

  await initStorage();

  const container = document.getElementById("display");
  if (!container) {
    throw new Error("Display container #display not found");
  }

  const client = connectMqtt({ brokerUrl, deviceId });
  const context: ClientContext = { client, deviceId };

  initScheduler({
    container,
    callbacks: {
      onDisplayStart: (manifest) => {
        publishDisplayStart({
          client,
          deviceId,
          campaignId: manifest.campaignId,
          version: manifest.version,
        });
      },
      onDisplayComplete: (manifest) => {
        publishDisplayComplete({
          client,
          deviceId,
          campaignId: manifest.campaignId,
          version: manifest.version,
        });
      },
    },
  });

  client.on("message", (topic, payload) => {
    try {
      const message = JSON.parse(payload.toString());

      if (topic === TOPICS.NOTIFICATIONS(deviceId)) {
        handleManifest(message as Manifest, context);
      } else if (topic === TOPICS.CONTROL(deviceId)) {
        handleControl(message as ControlMessage, context);
      }
    } catch (error) {
      console.error(
        `[mqtt] failed to parse message on topic ${topic}:`,
        error,
      );
    }
  });

  await checkAndSchedule();
  console.log("[main] screen client ready");
}

bootstrap().catch((error) => {
  console.error("[main] failed to initialize screen client:", error);
});
