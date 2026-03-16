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

function formatDate(value: number | string) {
  const date = new Date(typeof value === "string" ? Number(value) : value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function CampaignTable() {
  const { data, isLoading, isError, error } = useCampaigns()

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

  if (campaigns.length === 0) {
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
      <CardContent>
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
      </CardContent>
    </Card>
  )
}

export { CampaignTable }
