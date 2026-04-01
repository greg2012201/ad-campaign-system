import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DeviceEntity } from "../devices/device.entity";

type StreamBatchesParams = {
  batchSize: number;
  excludeDeviceIds?: Set<string>;
};

@Injectable()
export class DeviceStreamService {
  constructor(private readonly dataSource: DataSource) {}

  async *streamBatches({ batchSize, excludeDeviceIds }: StreamBatchesParams) {
    let cursor: string | null = null;

    while (true) {
      const qb = this.dataSource
        .getRepository(DeviceEntity)
        .createQueryBuilder("device")
        .orderBy("device.deviceId", "ASC")
        .take(batchSize);

      if (cursor) {
        qb.where("device.deviceId > :cursor", { cursor });
      }

      const rows = await qb.getMany();

      if (rows.length === 0) break;

      cursor = rows[rows.length - 1]!.deviceId;

      if (excludeDeviceIds && excludeDeviceIds.size > 0) {
        const filtered = rows.filter(
          (d) => !excludeDeviceIds.has(d.deviceId),
        );
        if (filtered.length > 0) {
          yield filtered;
        }
      } else {
        yield rows;
      }

      if (rows.length < batchSize) break;
    }
  }
}
