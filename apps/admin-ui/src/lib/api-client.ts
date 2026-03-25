const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000"

type AssetResponse = {
  id: string
  campaignId: string
  assetType: string
  url: string
  checksum: string | null
  durationMs: number | null
  sizeBytes: number | null
  createdAt: string
}

type CampaignResponse = {
  id: string
  name: string
  version: number
  startAt: number
  expireAt: number
  metadata: Record<string, unknown> | null
  status: string
  createdBy: string | null
  idempotencyKey: string | null
  createdAt: string
  updatedAt: string
  assets: AssetResponse[]
}

type CampaignListResponse = {
  data: CampaignResponse[]
  total: number
  offset: number
  limit: number
  page: number
  totalPages: number
}

type FetchCampaignsParams = {
  page: number
  limit: number
}

type CreateCampaignPayload = {
  name: string
  startAt: number
  expireAt: number
  assets: Array<{
    assetType: string
    url: string
    durationMs?: number
  }>
  metadata?: Record<string, unknown>
  idempotencyKey: string
}

async function apiFetch<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      error.message || `Request failed with status ${response.status}`
    )
  }

  return response.json() as Promise<T>
}

async function fetchCampaigns({ page, limit }: FetchCampaignsParams) {
  const offset = (page - 1) * limit
  const data = await apiFetch<CampaignListResponse>(
    `/campaigns?offset=${offset}&limit=${limit}`
  )
  return {
    ...data,
    page,
    totalPages: Math.ceil(data.total / limit),
  }
}

async function createCampaign(payload: CreateCampaignPayload) {
  return apiFetch<CampaignResponse>("/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export { fetchCampaigns, createCampaign }
export type {
  CampaignResponse,
  AssetResponse,
  CampaignListResponse,
  CreateCampaignPayload,
  FetchCampaignsParams,
}
