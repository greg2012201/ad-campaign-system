import { Module } from "@nestjs/common";
import { MqttProvider } from "./mqtt.provider";

@Module({
  providers: [MqttProvider],
  exports: [MqttProvider],
})
export class MqttModule {}
