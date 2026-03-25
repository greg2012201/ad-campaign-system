import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCampaigns } from "@/hooks/use-campaigns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type StatusVariant = "default" | "secondary" | "destructive" | "outline"

const STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  draft: "secondary",
  building: "outline",
  ready: "default",
  publishing: "outline",
  active: "default",
  completed: "secondary",
  cancelled: "destructive",
}

const PAGE_SIZE = 20

function formatDate(value: number | string) {
  const date = new Date(typeof value === "string" ? Number(value) : value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function CampaignTable() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, error, isPlaceholderData } = useCampaigns({
    page,
    limit: PAGE_SIZE,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Loading campaigns...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error?.message || "Failed to load campaigns"}
          </p>
        </CardContent>
      </Card>
    )
  }

  const campaigns = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  if (campaigns.length === 0 && page === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No campaigns found. Create one below.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start At</TableHead>
              <TableHead>Expire At</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT_MAP[campaign.status] ?? "secondary"}
                  >
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(campaign.startAt)}</TableCell>
                <TableCell>{formatDate(campaign.expireAt)}</TableCell>
                <TableCell>{campaign.version}</TableCell>
                <TableCell>{formatDate(campaign.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "campaign" : "campaigns"} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft />
            </Button>
            <span className="text-sm tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages || isPlaceholderData}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { CampaignTable }
