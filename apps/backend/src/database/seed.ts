import AppDataSource from "./data-source";
import { DeviceEntity, DeviceStatusEnum } from "../devices/device.entity";

async function seed() {
  await AppDataSource.initialize();

  const deviceRepo = AppDataSource.getRepository(DeviceEntity);

  const devices = [
    {
      deviceId: "dev-001",
      groupId: "lobby",
      status: DeviceStatusEnum.OFFLINE,
      metadata: { location: "Main Lobby", floor: 1 },
    },
    {
      deviceId: "dev-002",
      groupId: "lobby",
      status: DeviceStatusEnum.OFFLINE,
      metadata: { location: "Second Floor Hallway", floor: 2 },
    },
    {
      deviceId: "dev-003",
      groupId: "cafeteria",
      status: DeviceStatusEnum.OFFLINE,
      metadata: { location: "Cafeteria Entrance", floor: 1 },
    },
  ];

  for (const device of devices) {
    const exists = await deviceRepo.findOneBy({ deviceId: device.deviceId });
    if (!exists) {
      await deviceRepo.save(deviceRepo.create(device));
    }
  }

  console.log("Seed completed: 3 test devices inserted");
  await AppDataSource.destroy();
}

seed();
