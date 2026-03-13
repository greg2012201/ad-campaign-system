declare module "redlock" {
  import type { Redis } from "ioredis";

  type RedlockSettings = {
    driftFactor?: number;
    retryCount?: number;
    retryDelay?: number;
    retryJitter?: number;
    automaticExtensionThreshold?: number;
  };

  class Lock {
    readonly resources: string[];
    readonly value: string;
    readonly expiration: number;
    release(): Promise<void>;
    extend(duration: number): Promise<Lock>;
  }

  class Redlock {
    constructor(clients: Redis[], settings?: Partial<RedlockSettings>);
    acquire(
      resources: string[],
      duration: number,
    ): Promise<Lock>;
    release(lock: Lock): Promise<void>;
    quit(): Promise<void>;
  }

  export default Redlock;
  export { Lock };
}
