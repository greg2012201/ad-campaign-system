export type DeviceStatus = "online" | "offline";

export type Device = {
  deviceId: string;
  groupId: string;
  lastSeen: number;
  status: DeviceStatus;
  metadata: Record<string, unknown>;
};
