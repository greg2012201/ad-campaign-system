import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { OutboxEntity } from "./outbox.entity";
import { OutboxService } from "./outbox.service";
import {
  outboxRedisClientProvider,
  outboxRedlockProvider,
} from "./redlock.provider";

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEntity]),
    BullModule.registerQueue({ name: "template-build" }),
    BullModule.registerQueue({ name: "publish" }),
  ],
  providers: [OutboxService, outboxRedisClientProvider, outboxRedlockProvider],
  exports: [OutboxService],
})
export class OutboxModule {}
