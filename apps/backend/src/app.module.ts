import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
