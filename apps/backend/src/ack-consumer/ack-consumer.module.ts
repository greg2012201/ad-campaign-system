import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DeliveryEventEntity } from "./delivery-event.entity";
import { DeviceEntity } from "../devices/device.entity";
import { MqttModule } from "../publisher/mqtt.module";
import { AckConsumerService } from "./ack-consumer.service";
import { AckMqttSubscriber } from "./ack-mqtt-subscriber.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryEventEntity, DeviceEntity]),
    MqttModule,
  ],
  providers: [AckConsumerService, AckMqttSubscriber],
})
export class AckConsumerModule {}
