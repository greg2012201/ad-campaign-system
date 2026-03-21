type SweepProfile = {
  campaignCount: number;
  deviceCount: number;
  assetsPerCampaign: number;
  timeoutMs: number;
};

const profiles: Record<string, SweepProfile> = {
  small: {
    campaignCount: 1,
    deviceCount: 2,
    assetsPerCampaign: 1,
    timeoutMs: 30_000,
  },
  large: {
    campaignCount: 20,
    deviceCount: 50,
    assetsPerCampaign: 5,
    timeoutMs: 300_000,
  },
};

function getProfile(name?: string) {
  const profileName = name || process.env["E2E_SWEEP_PROFILE"] || "small";
  const profile = profiles[profileName];

  if (!profile) {
    throw new Error(`Unknown sweep profile: ${profileName}`);
  }

  return { ...profile, name: profileName };
}

export { getProfile, profiles };
export type { SweepProfile };
