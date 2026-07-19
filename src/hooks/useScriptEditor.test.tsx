import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useScriptEditor } from "./useScriptEditor"

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
  updateScript: vi.fn(),
  updateTitle: vi.fn(),
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    story: {
      get: { useSuspenseQuery: () => [mocks.story] },
      updateTitle: { useMutation: () => ({ mutate: mocks.updateTitle }) },
      updateScript: { useMutation: () => ({ mutate: mocks.updateScript }) },
    },
  },
}))

describe("useScriptEditor", () => {
  beforeEach(() => vi.clearAllMocks())

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

  // Parsing happens on the Characters step now, so navigating away inside the
  // debounce window is the normal route to it — the edit must not be lost.
  it("flushes a pending edit when the editor unmounts", () => {
    vi.useFakeTimers()
    try {
      const { result, unmount } = renderHook(() => useScriptEditor("s1"))
      act(() => result.current.onChangeScript("Edited then navigated away"))
      expect(mocks.updateScript).not.toHaveBeenCalled()

      unmount()
      expect(mocks.updateScript).toHaveBeenCalledWith({
        storyId: "s1",
        script: "Edited then navigated away",
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not resurrect text the author cleared before navigating away", () => {
    vi.useFakeTimers()
    try {
      const { result, unmount } = renderHook(() => useScriptEditor("s1"))
      act(() => result.current.onChangeScript("Typed then deleted"))
      act(() => result.current.onChangeScript(""))

      unmount()
      expect(mocks.updateScript).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not re-save an edit the debounce already flushed", () => {
    vi.useFakeTimers()
    try {
      const { result, unmount } = renderHook(() => useScriptEditor("s1"))
      act(() => result.current.onChangeScript("Saved on time"))
      act(() => vi.advanceTimersByTime(800))
      expect(mocks.updateScript).toHaveBeenCalledTimes(1)

      unmount()
      expect(mocks.updateScript).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("debounces title edits into a trimmed save", () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useScriptEditor("s1"))
      act(() => result.current.onChangeTitle("  Renamed  "))
      act(() => vi.advanceTimersByTime(800))
      expect(mocks.updateTitle).toHaveBeenCalledWith({
        storyId: "s1",
        title: "Renamed",
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
