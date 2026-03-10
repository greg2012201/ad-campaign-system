export const TOPICS = {
  NOTIFICATIONS: (deviceId: string) => `devices/${deviceId}/notifications`,
  ACKS: (deviceId: string) => `devices/${deviceId}/acks`,
  STATUS: (deviceId: string) => `devices/${deviceId}/status`,
  CONTROL: (deviceId: string) => `devices/${deviceId}/control`,
} as const;
