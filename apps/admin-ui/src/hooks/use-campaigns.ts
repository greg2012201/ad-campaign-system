import { useQuery } from "@tanstack/react-query"
import { fetchCampaigns } from "@/lib/api-client"
import type { FetchCampaignsParams } from "@/lib/api-client"

function useCampaigns({ page, limit }: FetchCampaignsParams) {
  return useQuery({
    queryKey: ["campaigns", { page, limit }],
    queryFn: () => fetchCampaigns({ page, limit }),
    placeholderData: (previousData) => previousData,
  })
}

export { useCampaigns }
