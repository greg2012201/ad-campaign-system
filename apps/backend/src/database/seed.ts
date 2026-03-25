import { faker } from "@faker-js/faker";
import AppDataSource from "./data-source";
import { DeviceEntity, DeviceStatusEnum } from "../devices/device.entity";

const DEVICE_COUNT = 20_000;
const BATCH_SIZE = 500;

const GROUP_IDS = [
  "lobby",
  "cafeteria",
  "parking",
  "warehouse",
  "office-a",
  "office-b",
  "conference",
  "reception",
  "gym",
  "rooftop",
];

function generateDevice(index: number) {
  const status = faker.helpers.arrayElement(Object.values(DeviceStatusEnum));
  const floor = faker.number.int({ min: 1, max: 20 });

  return {
    deviceId: `dev-${String(index).padStart(6, "0")}`,
    groupId: faker.helpers.arrayElement(GROUP_IDS),
    status,
    lastSeen:
      status === DeviceStatusEnum.ONLINE
        ? faker.date.recent({ days: 1 })
        : null,
    metadata: {
      location: faker.location.streetAddress(),
      floor,
      building: faker.helpers.arrayElement(["HQ", "Annex", "Tower", "Campus"]),
      installDate: faker.date.past({ years: 3 }).toISOString(),
    },
  };
}

async function seed() {
  await AppDataSource.initialize();

  const deviceRepo = AppDataSource.getRepository(DeviceEntity);

  const existingCount = await deviceRepo.count();
  if (existingCount >= DEVICE_COUNT) {
    console.log(`Seed skipped: ${existingCount} devices already exist`);
    await AppDataSource.destroy();
    return;
  }

  console.log(`Generating ${DEVICE_COUNT} devices...`);

  for (let i = 0; i < DEVICE_COUNT; i += BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(BATCH_SIZE, DEVICE_COUNT - i) },
      (_, j) => generateDevice(i + j + 1),
    );

    await deviceRepo
      .createQueryBuilder()
      .insert()
      .into(DeviceEntity)
      .values(batch)
      .orIgnore()
      .execute();

    if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= DEVICE_COUNT) {
      console.log(
        `Progress: ${Math.min(i + BATCH_SIZE, DEVICE_COUNT)}/${DEVICE_COUNT}`,
      );
    }
  }

  const finalCount = await deviceRepo.count();
  console.log(`Seed completed: ${finalCount} devices in database`);
  await AppDataSource.destroy();
}

seed();
