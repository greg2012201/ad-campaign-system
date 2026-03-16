import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/query-client"
import { CampaignTable } from "@/components/campaign-table"
import { CampaignForm } from "@/components/campaign-form"
import { Toaster } from "@/components/ui/sonner"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="mx-auto min-h-screen max-w-5xl space-y-6 p-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Campaign System Admin
        </h1>
        <CampaignTable />
        <CampaignForm />
      </div>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
