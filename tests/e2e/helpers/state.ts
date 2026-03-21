import type { ChildProcess } from "child_process";
import type { ContainerSet, ConnectionDetails } from "./containers.js";

type TestState = {
  containers: ContainerSet;
  connections: ConnectionDetails;
  processes: {
    backend: ChildProcess;
    adminUi: ChildProcess;
    screenClient: ChildProcess;
  };
  ports: {
    api: number;
    ui: number;
    screen: number;
  };
};

function setState(s: TestState) {
  (globalThis as Record<string, unknown>).__E2E_STATE = s;
}

function getState() {
  const s = (globalThis as Record<string, unknown>).__E2E_STATE as
    | TestState
    | undefined;
  if (!s) throw new Error("Test state not initialized");
  return s;
}

export { setState, getState };
export type { TestState };
