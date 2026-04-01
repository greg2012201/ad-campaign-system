import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

const KEY_TTL_SECONDS = 60 * 60 * 24;

type TrackParams = {
  campaignId: string;
  version: number;
  deviceIds: string[];
};

type CampaignVersionParams = {
  campaignId: string;
  version: number;
};

type RevokeTrackParams = {
  campaignId: string;
  deviceIds: string[];
};

type RevokeQueryParams = {
  campaignId: string;
};

@Injectable()
export class DevicePublishTracker implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get("REDIS_HOST", "localhost"),
      port: this.configService.getOrThrow<number>("REDIS_PORT"),
      keyPrefix: "pubtrack:",
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private buildKey({ campaignId, version }: CampaignVersionParams) {
    return `${campaignId}:v${version}`;
  }

  async markPublished({ campaignId, version, deviceIds }: TrackParams) {
    if (deviceIds.length === 0) return;

    const key = this.buildKey({ campaignId, version });
    const pipeline = this.redis.pipeline();
    pipeline.sadd(key, ...deviceIds);
    pipeline.expire(key, KEY_TTL_SECONDS);
    await pipeline.exec();
  }

  async getPublished({ campaignId, version }: CampaignVersionParams) {
    const key = this.buildKey({ campaignId, version });
    const members = await this.redis.smembers(key);
    return new Set(members);
  }

  private buildRevokeKey({ campaignId }: RevokeQueryParams) {
    return `revoke:${campaignId}`;
  }

  async markRevoked({ campaignId, deviceIds }: RevokeTrackParams) {
    if (deviceIds.length === 0) return;

    const key = this.buildRevokeKey({ campaignId });
    const pipeline = this.redis.pipeline();
    pipeline.sadd(key, ...deviceIds);
    pipeline.expire(key, KEY_TTL_SECONDS);
    await pipeline.exec();
  }

  public async getRevoked({ campaignId }: RevokeQueryParams) {
    const key = this.buildRevokeKey({ campaignId });
    const members = await this.redis.smembers(key);
    return new Set(members);
  }
}
