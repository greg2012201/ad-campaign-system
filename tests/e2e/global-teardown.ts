import { unlink } from "fs/promises";
import path from "path";
import { getState } from "./helpers/state.js";
import { stopContainers } from "./helpers/containers.js";
import { killProcess } from "./global-setup.js";

const ENV_TEST_PATH = path.resolve(import.meta.dirname, "../../.env.test");

async function globalTeardown() {
  if (process.env["E2E_BASE_URL"]) return;

  console.log("[e2e] Tearing down test infrastructure...");

  let state;
  try {
    state = getState();
  } catch {
    console.warn("[e2e] No test state found, skipping teardown");
    return;
  }

  killProcess(state.processes.backend);
  killProcess(state.processes.adminUi);
  console.log("[e2e] App processes stopped");

  await stopContainers(state.containers);
  console.log("[e2e] Containers stopped");

  try {
    await unlink(ENV_TEST_PATH);
  } catch {
    // file may not exist
  }

  console.log("[e2e] Teardown complete");
}

export default globalTeardown;
