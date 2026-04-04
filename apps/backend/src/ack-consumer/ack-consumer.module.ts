import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { DeliveryEventEntity } from "./delivery-event.entity";
import { DeviceEntity } from "../devices/device.entity";
import { AckConsumerService, ACK_QUEUE_NAME } from "./ack-consumer.service";
import { AckMqttSubscriber } from "./ack-mqtt-subscriber.service";
import { AckBatchProcessor } from "./ack-batch.processor";
import { MqttModule } from "../mqtt/mqtt.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryEventEntity, DeviceEntity]),
    BullModule.registerQueue({ name: ACK_QUEUE_NAME }),
    MqttModule,
  ],
  providers: [AckConsumerService, AckMqttSubscriber, AckBatchProcessor],
})
export class AckConsumerModule {}
