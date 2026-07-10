"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { movePage as domainMovePage } from "@/server/domain/pageOps"
import { nextFocusable } from "@/lib/pagesEditor"
import { trpc } from "@/lib/trpc"
import { useBulkGeneration } from "@/hooks/useBulkGeneration"
import {
  pageGenStateFromTasks,
  type PageGenState,
} from "@/hooks/usePageGeneration"
import { useStoryTasks } from "@/hooks/useTaskPolling"

function usePageMutations(storyId: string) {
  const utils = trpc.useUtils()
  const invalidate = () => utils.story.get.invalidate({ storyId })
  const onError = (error: { message: string }) => toast.error(error.message)

  const add = trpc.page.add.useMutation({ onSuccess: invalidate, onError })
  const remove = trpc.page.remove.useMutation({
    onSuccess: async () => {
      await invalidate()
      toast.success("Page removed")
    },
    onError,
  })
  const reorder = trpc.page.reorder.useMutation({
    onSuccess: invalidate,
    onError,
  })
  const selectImage = trpc.page.selectImage.useMutation({
    onSuccess: invalidate,
    onError,
  })
  const update = trpc.page.update.useMutation({
    onSuccess: invalidate,
    onError,
  })
  const setHidden = trpc.page.setHidden.useMutation({
    // Optimistically flip the page in the cached story so the grid/editor react
    // instantly; roll back on error, reconcile on settle.
    onMutate: async ({ pageId, hidden }) => {
      await utils.story.get.cancel({ storyId })
      const previous = utils.story.get.getData({ storyId })
      if (previous) {
        utils.story.get.setData(
          { storyId },
          {
            ...previous,
            pages: previous.pages.map((page) =>
              page.id === pageId ? { ...page, hidden } : page
            ),
          }
        )
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        utils.story.get.setData({ storyId }, context.previous)
      }
      onError(error)
    },
    onSettled: invalidate,
  })

  return { add, remove, reorder, selectImage, setHidden, update }
}

/**
 * Orchestrates the page editor: loads the story (pages + characters + rules)
 * via suspense, tracks the focused page, and composes bulk generation and page
 * mutations. Pure logic lives in `@/lib/pagesEditor`; this hook only wires state
 * and network.
 */
export function usePagesEditor(
  storyId: string,
  initialFocusedPageId: string | null = null
) {
  const [story] = trpc.story.get.useSuspenseQuery({ storyId })
  const pages = useMemo(
    () => [...story.pages].sort((a, b) => a.position - b.position),
    [story.pages]
  )
  const pageIds = useMemo(() => pages.map((page) => page.id), [pages])

  const { tasks } = useStoryTasks(storyId)
  const bulk = useBulkGeneration(storyId, pageIds)
  const mutations = usePageMutations(storyId)

  const [focusedPageId, setFocusedPageId] = useState<string | null>(
    initialFocusedPageId
  )
  const focusedPage = pages.find((page) => page.id === focusedPageId) ?? null

  const genStates = useMemo(() => {
    const map: Record<string, PageGenState> = {}
    for (const page of pages) {
      const pageTasks = tasks.filter(
        (task) => task.type === "PAGE_IMAGE" && task.pageId === page.id
      )
      map[page.id] = pageGenStateFromTasks(
        pageTasks,
        Boolean(page.selectedImageUrl)
      )
    }
    return map
  }, [pages, tasks])

  return {
    story,
    pages,
    characters: story.characters,
    rules: story.rules,
    genStates,

    // Selection / bulk generation.
    selection: bulk.selected,
    isAllSelected: bulk.isAllSelected,
    toggleSelect: bulk.toggle,
    selectAll: bulk.selectAll,
    selectNone: bulk.selectNone,
    bulkProgress: bulk.progress,
    generateSelected: bulk.generate,

    // Focus / navigation (includes hidden pages by design).
    focusedPageId,
    focusedPage,
    focus: setFocusedPageId,
    closeFocus: () => setFocusedPageId(null),
    hasNext:
      focusedPageId !== null &&
      nextFocusable(pages, focusedPageId, 1) !== undefined,
    hasPrev:
      focusedPageId !== null &&
      nextFocusable(pages, focusedPageId, -1) !== undefined,
    goNext: () => {
      if (focusedPageId === null) return
      const next = nextFocusable(pages, focusedPageId, 1)
      if (next) setFocusedPageId(next)
    },
    goPrev: () => {
      if (focusedPageId === null) return
      const prev = nextFocusable(pages, focusedPageId, -1)
      if (prev) setFocusedPageId(prev)
    },

    // Structural mutations.
    addPage: (afterPageId?: string) =>
      mutations.add.mutate(
        { storyId, afterPageId },
        { onSuccess: (created) => setFocusedPageId(created.id) }
      ),
    removePage: (pageId: string) => {
      const fallback =
        nextFocusable(pages, pageId, 1) ?? nextFocusable(pages, pageId, -1)
      mutations.remove.mutate(
        { pageId },
        {
          onSuccess: () => {
            if (focusedPageId === pageId) setFocusedPageId(fallback ?? null)
          },
        }
      )
    },
    setHidden: (pageId: string, hidden: boolean) =>
      mutations.setHidden.mutate({ pageId, hidden }),
    movePage: (pageId: string, dir: 1 | -1) => {
      const target = pages.find((page) => page.id === pageId)
      if (!target) return
      const ordered = domainMovePage(pages, pageId, target.position + dir)
      mutations.reorder.mutate({
        storyId,
        orderedPageIds: ordered.map((page) => page.id),
      })
    },
    selectImage: (pageId: string, pageImageId: string) =>
      mutations.selectImage.mutate({ pageId, pageImageId }),
    setCharacters: (pageId: string, characterIds: string[]) =>
      mutations.update.mutate({ pageId, characterIds }),
  }
}
