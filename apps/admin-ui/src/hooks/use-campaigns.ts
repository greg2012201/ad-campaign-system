import { useQuery } from "@tanstack/react-query"
import { fetchCampaigns } from "@/lib/api-client"

function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
  })
}

export { useCampaigns }
