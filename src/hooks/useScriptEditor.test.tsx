import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useScriptEditor } from "./useScriptEditor"
import { task as makeTask } from "@/server/domain/testFactories"
import type { Task } from "@/server/domain/types"

const mocks = vi.hoisted(() => ({
  story: {
    id: "s1",
    userId: "u1",
    title: "",
    script: "Sam visits the dentist.",
    kind: "STORY" as const,
    templateId: null,
    status: "DRAFT" as const,
    baseImageUrl: null as string | null,
    coverNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    counts: { characters: 0, rules: 0, pages: 0, pagesWithImage: 0 },
  },
  task: undefined as Task | undefined,
  parseOnSuccess: undefined as ((data: { taskId: string }) => void) | undefined,
  parseMutate: vi.fn(),
  updateScript: vi.fn(),
  updateScriptAsync: vi.fn(),
  updateTitle: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ story: { get: { invalidate: mocks.invalidate } } }),
    story: {
      get: { useSuspenseQuery: () => [mocks.story] },
      updateTitle: { useMutation: () => ({ mutate: mocks.updateTitle }) },
      updateScript: {
        useMutation: () => ({
          mutate: mocks.updateScript,
          mutateAsync: mocks.updateScriptAsync,
        }),
      },
      parse: {
        useMutation: (opts: {
          onSuccess?: (data: { taskId: string }) => void
        }) => {
          mocks.parseOnSuccess = opts.onSuccess
          return { mutate: mocks.parseMutate, isPending: false }
        },
      },
    },
  },
}))
vi.mock("@/hooks/useTaskPolling", () => ({
  useTask: () => ({ data: mocks.task }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("useScriptEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.task = undefined
    mocks.parseMutate.mockImplementation(() =>
      mocks.parseOnSuccess?.({ taskId: "t1" })
    )
  })

  it("moves from idle through parsing to done as the task polls", async () => {
    const { result, rerender } = renderHook(() => useScriptEditor("s1"))
    expect(result.current.parseState).toBe("idle")

    await act(async () => {
      await result.current.onParse()
    })
    expect(mocks.parseMutate).toHaveBeenCalledWith({ storyId: "s1" })

    mocks.task = makeTask("RUNNING")
    rerender()
    expect(result.current.parseState).toBe("parsing")

    mocks.task = makeTask("SUCCEEDED", { resultJson: { pageCount: 20 } })
    rerender()
    expect(result.current.parseState).toBe("done")
    expect(result.current.pageCount).toBe(20)
    expect(mocks.invalidate).toHaveBeenCalledWith({
      storyId: "s1",
      kind: "STORY",
    })
  })

  it("debounces script edits into a save", () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useScriptEditor("s1"))
      act(() => result.current.onChangeScript("A brand new script"))
      expect(mocks.updateScript).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(800))
      expect(mocks.updateScript).toHaveBeenCalledWith({
        storyId: "s1",
        script: "A brand new script",
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
