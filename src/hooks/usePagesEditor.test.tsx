import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const now = new Date("2026-01-01T00:00:00Z")
  const makePage = (
    id: string,
    position: number,
    kind: "COVER" | "PAGE" = "PAGE"
  ) => ({
    id,
    storyId: "s1",
    kind,
    position,
    text: id,
    imagePrompt: id,
    characterIds: [] as string[],
    steeringText: null,
    hidden: false,
    selectedImageId: null,
    createdAt: now,
    updatedAt: now,
    selectedImageUrl: null as string | null,
  })
  const story = {
    id: "s1",
    userId: "u1",
    title: "T",
    script: "s",
    status: "PARSED" as const,
    baseImageUrl: null as string | null,
    coverNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    characters: [],
    rules: [],
    pages: [makePage("cover", 0, "COVER"), makePage("a", 1), makePage("b", 2)],
    counts: { characters: 0, rules: 0, pages: 3, pagesWithImage: 0 },
  }
  return {
    story,
    cancel: vi.fn(),
    getData: vi.fn(() => story),
    setData: vi.fn(),
    invalidate: vi.fn(),
    setHiddenOpts: undefined as
      | {
          onMutate?: (vars: { pageId: string; hidden: boolean }) => unknown
          onError?: (err: unknown, vars: unknown, ctx: unknown) => void
        }
      | undefined,
    setHiddenMutate: vi.fn(),
  }
})

vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ mutate: vi.fn() })
  return {
    trpc: {
      useUtils: () => ({
        story: {
          get: {
            invalidate: mocks.invalidate,
            cancel: mocks.cancel,
            getData: mocks.getData,
            setData: mocks.setData,
          },
        },
      }),
      story: { get: { useSuspenseQuery: () => [mocks.story] } },
      page: {
        add: { useMutation: mutation },
        remove: { useMutation: mutation },
        reorder: { useMutation: mutation },
        selectImage: { useMutation: mutation },
        update: { useMutation: mutation },
        setHidden: {
          useMutation: (opts: typeof mocks.setHiddenOpts) => {
            mocks.setHiddenOpts = opts
            return { mutate: mocks.setHiddenMutate }
          },
        },
      },
    },
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/hooks/useTaskPolling", () => ({
  useStoryTasks: () => ({ tasks: [] }),
}))

vi.mock("@/hooks/useBulkGeneration", () => ({
  useBulkGeneration: () => ({
    selected: new Set<string>(),
    isAllSelected: false,
    toggle: vi.fn(),
    selectAll: vi.fn(),
    selectNone: vi.fn(),
    progress: { pending: 0, running: 0, failed: 0, done: 0 },
    generate: vi.fn(),
  }),
}))

// Imported after the mocks are registered.
import { usePagesEditor } from "./usePagesEditor"

describe("usePagesEditor", () => {
  beforeEach(() => vi.clearAllMocks())

  it("navigates focus across pages without wrapping", () => {
    const { result } = renderHook(() => usePagesEditor("s1"))
    expect(result.current.focusedPageId).toBeNull()

    act(() => result.current.focus("a"))
    expect(result.current.focusedPage?.id).toBe("a")
    expect(result.current.hasPrev).toBe(true)
    expect(result.current.hasNext).toBe(true)

    act(() => result.current.goNext())
    expect(result.current.focusedPageId).toBe("b")
    expect(result.current.hasNext).toBe(false)

    // Already at the last page: goNext is a no-op.
    act(() => result.current.goNext())
    expect(result.current.focusedPageId).toBe("b")

    act(() => result.current.goPrev())
    expect(result.current.focusedPageId).toBe("a")
  })

  it("optimistically flips hidden in the cached story and rolls back on error", async () => {
    renderHook(() => usePagesEditor("s1"))
    const opts = mocks.setHiddenOpts!

    await act(async () => {
      await opts.onMutate?.({ pageId: "a", hidden: true })
    })
    expect(mocks.cancel).toHaveBeenCalledWith({
      storyId: "s1",
      kind: "STORY",
    })
    const optimistic = mocks.setData.mock.calls[0][1] as typeof mocks.story
    expect(optimistic.pages.find((p) => p.id === "a")?.hidden).toBe(true)

    act(() => {
      opts.onError?.(
        new Error("boom"),
        { pageId: "a", hidden: true },
        {
          previous: mocks.story,
        }
      )
    })
    // Rollback restores the pre-mutation snapshot.
    expect(mocks.setData).toHaveBeenLastCalledWith(
      { storyId: "s1", kind: "STORY" },
      mocks.story
    )
  })
})
