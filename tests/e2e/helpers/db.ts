import { execSync } from "child_process";
import path from "path";
import pg from "pg";

type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

const BACKEND_DIR = path.resolve(import.meta.dirname, "../../../apps/backend");

function buildEnv(config: DbConfig) {
  return {
    ...process.env,
    POSTGRES_HOST: config.host,
    POSTGRES_PORT: String(config.port),
    POSTGRES_USER: config.user,
    POSTGRES_PASSWORD: config.password,
    POSTGRES_DB: config.database,
  };
}

async function runMigrations(config: DbConfig) {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await client.end();

  execSync("pnpm run migration:run", {
    cwd: BACKEND_DIR,
    env: buildEnv(config),
    stdio: "pipe",
  });
}

async function seedDevices(config: DbConfig) {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  await client.connect();

  const devices = Array.from({ length: 10 }, (_, i) => ({
    deviceId: `dev-${String(i + 1).padStart(3, "0")}`,
    groupId: i < 5 ? "lobby" : "cafeteria",
    status: "offline",
    metadata: JSON.stringify({
      location: `Test Location ${i + 1}`,
      floor: (i % 3) + 1,
    }),
  }));

  for (const device of devices) {
    await client.query(
      `INSERT INTO devices ("device_id", "group_id", "status", "metadata")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("device_id") DO NOTHING`,
      [device.deviceId, device.groupId, device.status, device.metadata],
    );
  }

  await client.end();
}

export { runMigrations, seedDevices };
export type { DbConfig };
