import { z } from "zod/v4";

const assetSchema = z.object({
  assetType: z.enum(["image", "video", "html"]),
  url: z.url(),
  durationMs: z.number().int().min(0).optional(),
});

const createCampaignSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startAt: z.string().min(1, "Start date is required"),
  expireAt: z.string().min(1, "Expiry date is required"),
  assets: z.array(assetSchema).min(1, "At least one asset is required"),
});

type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export { createCampaignSchema };
export type { CreateCampaignInput };
