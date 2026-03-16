import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  createCampaignSchema,
  type CreateCampaignInput,
} from "@/schemas/campaign"
import { useCreateCampaign } from "@/hooks/use-create-campaign"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"
import { Trash2Icon, PlusIcon } from "lucide-react"

function CampaignForm() {
  const createCampaign = useCreateCampaign()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateCampaignInput>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      name: "",
      startAt: "",
      expireAt: "",
      assets: [{ assetType: "image", url: "", durationMs: undefined }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "assets",
  })

  function onSubmit(data: CreateCampaignInput) {
    const idempotencyKey = crypto.randomUUID()

    createCampaign.mutate(
      {
        name: data.name,
        startAt: new Date(data.startAt).getTime(),
        expireAt: new Date(data.expireAt).getTime(),
        assets: data.assets.map((asset) => ({
          assetType: asset.assetType,
          url: asset.url,
          durationMs: asset.durationMs,
        })),
        idempotencyKey,
      },
      {
        onSuccess: () => {
          toast.success("Campaign created successfully")
          reset()
        },
        onError: (error) => {
          toast.error(error.message || "Failed to create campaign")
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Campaign</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Campaign name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startAt">Start At</Label>
              <Input
                id="startAt"
                type="datetime-local"
                {...register("startAt")}
              />
              {errors.startAt && (
                <p className="text-sm text-destructive">
                  {errors.startAt.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expireAt">Expire At</Label>
              <Input
                id="expireAt"
                type="datetime-local"
                {...register("expireAt")}
              />
              {errors.expireAt && (
                <p className="text-sm text-destructive">
                  {errors.expireAt.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Assets</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({ assetType: "image", url: "", durationMs: undefined })
                }
              >
                <PlusIcon className="mr-1 size-4" />
                Add Asset
              </Button>
            </div>
            {errors.assets?.root && (
              <p className="text-sm text-destructive">
                {errors.assets.root.message}
              </p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <select
                  {...register(`assets.${index}.assetType`)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="html">HTML</option>
                </select>
                <div className="min-w-0 flex-1">
                  <Input
                    placeholder="Asset URL"
                    {...register(`assets.${index}.url`)}
                  />
                  {errors.assets?.[index]?.url && (
                    <p className="text-sm text-destructive">
                      {errors.assets[index].url.message}
                    </p>
                  )}
                </div>
                <Input
                  type="number"
                  placeholder="Duration (ms)"
                  className="w-36"
                  {...register(`assets.${index}.durationMs`, {
                    setValueAs: (v: string) =>
                      v === "" ? undefined : Number(v),
                  })}
                />
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button type="submit" disabled={createCampaign.isPending}>
            {createCampaign.isPending ? "Creating..." : "Create Campaign"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export { CampaignForm }
