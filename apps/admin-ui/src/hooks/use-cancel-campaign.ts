import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cancelCampaign } from "@/lib/api-client"

function useCancelCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => cancelCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })
}

export { useCancelCampaign }
