import { spawn } from "child_process";
import path from "path";
import { writeFile } from "fs/promises";
import { startContainers } from "./helpers/containers.js";
import { runMigrations, seedDevices } from "./helpers/db.js";
import { setState } from "./helpers/state.js";
import type { FullConfig } from "@playwright/test";
import type { ChildProcess } from "child_process";

const API_PORT = 3100;
const UI_PORT = 5200;
const ROOT_DIR = path.resolve(import.meta.dirname, "../..");
const ENV_TEST_PATH = path.join(ROOT_DIR, ".env.test");

async function waitForUrl(url: string, timeout = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnApp({
  command,
  args,
  cwd,
  env,
}: {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}) {
  const proc = spawn(command, args, {
    cwd,
    env,
    stdio: "pipe",
    detached: true,
  });

  proc.unref();

  proc.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString();
    if (msg.includes("Error") || msg.includes("error")) {
      console.error(`[${path.basename(cwd)}] ${msg}`);
    }
  });

  return proc;
}

function killProcess(proc: ChildProcess) {
  if (proc.pid) {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      try {
        proc.kill("SIGTERM");
      } catch {
        // already dead
      }
    }
  }
}

async function globalSetup(_config: FullConfig) {
  if (process.env["E2E_BASE_URL"]) {
    console.log("Using external environment:", process.env["E2E_BASE_URL"]);
    return;
  }

  console.log("[e2e] Starting test infrastructure...");

  const { containers, connections } = await startContainers();
  console.log("[e2e] Containers started");

  await runMigrations(connections.postgres);
  console.log("[e2e] Migrations completed");

  await seedDevices(connections.postgres);
  console.log("[e2e] Seeding completed");

  const envContent = [
    `POSTGRES_HOST=${connections.postgres.host}`,
    `POSTGRES_PORT=${connections.postgres.port}`,
    `POSTGRES_USER=${connections.postgres.user}`,
    `POSTGRES_PASSWORD=${connections.postgres.password}`,
    `POSTGRES_DB=${connections.postgres.database}`,
    `REDIS_HOST=${connections.redis.host}`,
    `REDIS_PORT=${connections.redis.port}`,
    `MQTT_BROKER_URL=${connections.mqtt.tcpUrl}`,
    `MQTT_WS_URL=${connections.mqtt.wsUrl}`,
    `API_PORT=${API_PORT}`,
    `API_CORS_ORIGIN=http://localhost:${UI_PORT}`,
  ].join("\n");

  await writeFile(ENV_TEST_PATH, envContent);

  const backendEnv = {
    ...process.env,
    POSTGRES_HOST: connections.postgres.host,
    POSTGRES_PORT: String(connections.postgres.port),
    POSTGRES_USER: connections.postgres.user,
    POSTGRES_PASSWORD: connections.postgres.password,
    POSTGRES_DB: connections.postgres.database,
    REDIS_HOST: connections.redis.host,
    REDIS_PORT: String(connections.redis.port),
    MQTT_BROKER_URL: connections.mqtt.tcpUrl,
    MQTT_WS_URL: connections.mqtt.wsUrl,
    API_PORT: String(API_PORT),
    API_CORS_ORIGIN: `http://localhost:${UI_PORT}`,
    NODE_ENV: "test",
  };

  const backendProcess = spawnApp({
    command: "pnpm",
    args: ["exec", "nest", "start"],
    cwd: path.join(ROOT_DIR, "apps/backend"),
    env: backendEnv,
  });

  const adminUiProcess = spawnApp({
    command: "pnpm",
    args: ["exec", "vite", "--port", String(UI_PORT)],
    cwd: path.join(ROOT_DIR, "apps/admin-ui"),
    env: {
      ...process.env,
      VITE_API_URL: `http://localhost:${API_PORT}`,
    },
  });

  await Promise.all([
    waitForUrl(`http://localhost:${API_PORT}`),
    waitForUrl(`http://localhost:${UI_PORT}`),
  ]);
  console.log("[e2e] Apps started and healthy");

  process.env["E2E_API_URL"] = `http://localhost:${API_PORT}`;
  process.env["E2E_UI_URL"] = `http://localhost:${UI_PORT}`;
  process.env["E2E_MQTT_WS_URL"] = connections.mqtt.wsUrl;

  setState({
    containers,
    connections,
    processes: { backend: backendProcess, adminUi: adminUiProcess },
    ports: { api: API_PORT, ui: UI_PORT },
  });

  process.on("exit", () => {
    killProcess(backendProcess);
    killProcess(adminUiProcess);
  });
}

export { killProcess };
export default globalSetup;
