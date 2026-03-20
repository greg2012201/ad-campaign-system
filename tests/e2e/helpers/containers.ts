import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Wait } from "testcontainers";
import type { StartedPostgreSqlContainer, StartedTestContainer } from "testcontainers";

type ContainerSet = {
  postgres: StartedPostgreSqlContainer;
  redis: StartedTestContainer;
  mosquitto: StartedTestContainer;
};

type ConnectionDetails = {
  postgres: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
  };
  mqtt: {
    tcpUrl: string;
    wsUrl: string;
    tcpPort: number;
    wsPort: number;
  };
};

const MOSQUITTO_CONF = [
  "listener 1883",
  "listener 9001",
  "protocol websockets",
  "allow_anonymous true",
].join("\n");

async function startMosquitto() {
  return new GenericContainer("eclipse-mosquitto:2")
    .withExposedPorts(1883, 9001)
    .withCopyContentToContainer([
      { content: MOSQUITTO_CONF, target: "/mosquitto/config/mosquitto.conf" },
    ])
    .withWaitStrategy(Wait.forLogMessage(/mosquitto version/))
    .start();
}

async function startContainers() {
  const [postgres, redis, mosquitto] = await Promise.all([
    new PostgreSqlContainer("postgres:17")
      .withDatabase("campaign_test")
      .withUsername("test")
      .withPassword("test")
      .start(),

    new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
      .start(),

    startMosquitto(),
  ]);

  const connections: ConnectionDetails = {
    postgres: {
      host: postgres.getHost(),
      port: postgres.getMappedPort(5432),
      user: postgres.getUsername(),
      password: postgres.getPassword(),
      database: postgres.getDatabase(),
    },
    redis: {
      host: redis.getHost(),
      port: redis.getMappedPort(6379),
    },
    mqtt: {
      tcpUrl: `mqtt://${mosquitto.getHost()}:${mosquitto.getMappedPort(1883)}`,
      wsUrl: `ws://${mosquitto.getHost()}:${mosquitto.getMappedPort(9001)}`,
      tcpPort: mosquitto.getMappedPort(1883),
      wsPort: mosquitto.getMappedPort(9001),
    },
  };

  return { containers: { postgres, redis, mosquitto } as ContainerSet, connections };
}

async function stopContainers(containers: ContainerSet) {
  await Promise.all([
    containers.postgres.stop(),
    containers.redis.stop(),
    containers.mosquitto.stop(),
  ]);
}

export { startContainers, stopContainers };
export type { ContainerSet, ConnectionDetails };
