import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { OutboxModule } from "./outbox/outbox.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        host: config.get("POSTGRES_HOST", "localhost"),
        port: config.getOrThrow<number>("POSTGRES_PORT"),
        username: config.get("POSTGRES_USER", "campaign"),
        password: config.get("POSTGRES_PASSWORD", "campaign_secret"),
        database: config.get<string>("POSTGRES_DB", "campaign"),
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get("REDIS_HOST", "localhost"),
          port: config.getOrThrow<number>("REDIS_PORT"),
        },
      }),
    }),
    CampaignsModule,
    OutboxModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
