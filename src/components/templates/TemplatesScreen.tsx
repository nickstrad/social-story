"use client"

import type { inferRouterOutputs } from "@trpc/server"
import Link from "next/link"
import { useState } from "react"
import {
  LayoutTemplateIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { UseTemplateDialog } from "./UseTemplateDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useInstantiateTemplate } from "@/hooks/useInstantiateTemplate"
import { trpc } from "@/lib/trpc"
import type { AppRouter } from "@/server/api/root"

type Template = inferRouterOutputs<AppRouter>["template"]["list"][number]

export function TemplatesScreen() {
  const utils = trpc.useUtils()
  const [templates] = trpc.template.list.useSuspenseQuery()
  const [libraryCharacters] = trpc.library.characters.list.useSuspenseQuery()
  const [useTarget, setUseTarget] = useState<Template>()
  const [deleteTarget, setDeleteTarget] = useState<Template>()
  const template = trpc.template.getForUse.useQuery(
    { templateId: useTarget?.id ?? "" },
    { enabled: Boolean(useTarget) }
  )
  const instantiate = useInstantiateTemplate()
  const remove = trpc.story.delete.useMutation({
    onSuccess: async () => {
      await utils.template.list.invalidate()
      toast.success("Template deleted")
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <PageLayout spacing="relaxed">
      <PageHeader
        title="Templates"
        description="Reuse a finished script, cast structure, and page plan for new people."
      />

      {templates.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="truncate">
                  {item.title.trim() || "Untitled template"}
                </CardTitle>
                <CardDescription>
                  {item.counts.characters} role
                  {item.counts.characters === 1 ? "" : "s"} ·{" "}
                  {item.counts.pages} page{item.counts.pages === 1 ? "" : "s"}
                </CardDescription>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete template"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2Icon />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => setUseTarget(item)}>
                  <PlayIcon />
                  Use template
                </Button>
                <Button
                  variant="outline"
                  render={
                    <Link href={`/stories/${item.id}/script?template=1`} />
                  }
                >
                  <PencilIcon />
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutTemplateIcon />
            </EmptyMedia>
            <EmptyTitle>No templates yet</EmptyTitle>
            <EmptyDescription>
              Finish a story, then save it as a reusable template from Export.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <UseTemplateDialog
        key={`${useTarget?.id ?? "closed"}:${template.data?.id ?? "loading"}`}
        open={Boolean(useTarget)}
        template={template.data}
        libraryCharacters={libraryCharacters}
        isSubmitting={instantiate.isPending}
        onOpenChange={(open) => {
          if (!open) setUseTarget(undefined)
        }}
        onSubmit={async ({ title, cast }) => {
          if (!useTarget) return
          await instantiate.mutateAsync({
            templateId: useTarget.id,
            title,
            cast,
          })
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing stories created from it stay intact. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove.mutate({ storyId: deleteTarget.id })
                setDeleteTarget(undefined)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
