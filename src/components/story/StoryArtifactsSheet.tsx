"use client"

import Image from "next/image"
import { ChevronRightIcon, FileTextIcon, UsersIcon } from "lucide-react"
import type { inferRouterOutputs } from "@trpc/server"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AppRouter } from "@/server/api/root"
import { cn } from "@/lib/utils"

type StoryArtifacts = inferRouterOutputs<AppRouter>["artifact"]["forStory"]

export function StoryArtifactsSheet({
  data,
  loading,
}: {
  data?: StoryArtifacts
  loading: boolean
}) {
  return (
    <SheetContent className="w-[calc(100%-0.75rem)] gap-0 sm:max-w-2xl">
      <SheetHeader className="border-b px-5 py-4">
        <SheetTitle>Story artifacts</SheetTitle>
        <SheetDescription>
          A live view of everything this story has created so far.
        </SheetDescription>
      </SheetHeader>
      {loading || !data ? (
        <ArtifactsLoading />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-8 p-5 pb-10">
            <ArtifactSummary data={data} />
            <StoryScript script={data.story.script} />
            <StoryPages pages={data.pages} />
            <CastAndRules characters={data.characters} rules={data.rules} />
            <GeneratedFiles artifacts={data.generated} />
          </div>
        </ScrollArea>
      )}
    </SheetContent>
  )
}

function StoryScript({ script }: { script: string }) {
  return (
    <ArtifactSection number="01" title="Story script">
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="whitespace-pre-wrap text-sm leading-6">{script}</p>
      </div>
    </ArtifactSection>
  )
}

function StoryPages({ pages }: { pages: StoryArtifacts["pages"] }) {
  if (pages.length === 0) return null
  return (
    <ArtifactSection number="02" title={`Story pages · ${pages.length}`}>
      <div className="grid gap-2">
        {pages.map((page) => (
          <article
            key={page.id}
            className="grid grid-cols-[3.5rem_1fr] gap-3 rounded-xl border p-2.5"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              {page.selectedImageUrl ? (
                <Image
                  unoptimized
                  fill
                  src={page.selectedImageUrl}
                  alt=""
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center text-muted-foreground">
                  <FileTextIcon className="size-4" />
                </div>
              )}
            </div>
            <div className="min-w-0 py-0.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {page.kind === "COVER" ? "Cover" : `Page ${page.position}`}
              </p>
              <p className="mt-1 line-clamp-2 text-sm leading-5">{page.text}</p>
            </div>
          </article>
        ))}
      </div>
    </ArtifactSection>
  )
}

function CastAndRules({
  characters,
  rules,
}: Pick<StoryArtifacts, "characters" | "rules">) {
  if (characters.length === 0 && rules.length === 0) return null
  return (
    <ArtifactSection number="03" title="Cast and visual rules">
      {characters.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {characters.map((character) => {
            const details = [
              character.role,
              character.age,
              character.appearance,
            ]
              .filter(Boolean)
              .join(" · ")
            return (
              <article
                key={character.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-muted">
                  {character.photoUrl ? (
                    <Image
                      unoptimized
                      fill
                      src={character.photoUrl}
                      alt=""
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <UsersIcon className="size-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{character.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {details || "Character details not added yet"}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rules.map((rule) => (
            <Badge key={rule.id} variant="outline">
              {rule.text}
            </Badge>
          ))}
        </div>
      )}
    </ArtifactSection>
  )
}

function GeneratedFiles({
  artifacts,
}: {
  artifacts: StoryArtifacts["generated"]
}) {
  if (artifacts.length === 0) return null
  return (
    <ArtifactSection
      number="04"
      title={`Generated files · ${artifacts.length}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {artifacts.map((artifact) => (
          <a
            key={artifact.id}
            href={artifact.url}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border transition-colors hover:bg-muted/40"
          >
            <div className="relative aspect-video bg-muted">
              {artifact.kind === "PDF" ? (
                <div className="grid size-full place-items-center text-muted-foreground">
                  <FileTextIcon className="size-8" />
                </div>
              ) : (
                <Image
                  unoptimized
                  fill
                  src={artifact.url}
                  alt={artifact.label}
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover transition-transform group-hover:scale-[1.02]"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 p-3">
              <span className="truncate text-sm font-medium">
                {artifact.label}
              </span>
              <Badge variant="secondary">
                {artifact.kind.replaceAll("_", " ")}
              </Badge>
            </div>
          </a>
        ))}
      </div>
    </ArtifactSection>
  )
}

function ArtifactSummary({ data }: { data: StoryArtifacts }) {
  const words = data.story.script.trim().split(/\s+/).filter(Boolean).length
  const items = [
    ["Script", `${words} words`],
    ["Pages", String(data.pages.length)],
    ["Characters", String(data.characters.length)],
    ["Files", String(data.generated.length)],
  ]
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4">
      {items.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "p-3",
            index % 2 === 0 && "border-r",
            index >= 2 && "border-t sm:border-t-0",
            index < 3 && "sm:border-r"
          )}
        >
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-heading text-lg font-medium tabular-nums">
            {value}
          </p>
          {index === 3 ? null : <span className="sr-only">,</span>}
        </div>
      ))}
    </div>
  )
}

function ArtifactSection({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Collapsible render={<section />}>
      <h3>
        <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-lg py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span
            aria-hidden="true"
            className="font-mono text-xs text-muted-foreground transition-colors group-hover:text-foreground"
          >
            {number}
          </span>
          <span className="font-heading font-medium">{title}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-data-panel-open:rotate-90"
          />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ArtifactsLoading() {
  return (
    <div className="grid gap-6 p-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <div className="grid gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    </div>
  )
}
