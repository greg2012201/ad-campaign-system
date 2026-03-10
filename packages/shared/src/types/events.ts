export type EventType =
  | "INSTALL_ACK"
  | "DISPLAY_START"
  | "DISPLAY_COMPLETE"
  | "ERROR";

type BaseEvent = {
  eventId: string;
  eventType: EventType;
  deviceId: string;
  campaignId: string;
  version: number;
  timestamp: number;
};

export type InstallAck = BaseEvent & {
  eventType: "INSTALL_ACK";
};

export type DisplayStart = BaseEvent & {
  eventType: "DISPLAY_START";
};

export type DisplayComplete = BaseEvent & {
  eventType: "DISPLAY_COMPLETE";
};

export type ErrorEvent = BaseEvent & {
  eventType: "ERROR";
  errorCode: string;
  errorMessage: string;
};
