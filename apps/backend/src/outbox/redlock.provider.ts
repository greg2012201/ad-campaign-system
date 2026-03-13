import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import Redlock from "redlock";

export const OUTBOX_REDIS_CLIENT = "OUTBOX_REDIS_CLIENT";
export const OUTBOX_REDLOCK = "OUTBOX_REDLOCK";

export const outboxRedisClientProvider: Provider = {
  provide: OUTBOX_REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new Redis({
      host: config.get("REDIS_HOST", "localhost"),
      port: config.getOrThrow<number>("REDIS_PORT"),
    });
  },
};

export const outboxRedlockProvider: Provider = {
  provide: OUTBOX_REDLOCK,
  inject: [OUTBOX_REDIS_CLIENT],
  useFactory: (client: Redis) => {
    return new Redlock([client], {
      retryCount: 0,
    });
  },
};
