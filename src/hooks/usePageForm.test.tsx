import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { page as makePage } from "@/server/domain/testFactories"
import { usePageForm } from "./usePageForm"

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ story: { get: { invalidate: mocks.invalidate } } }),
    page: {
      update: { useMutation: () => ({ mutate: mocks.update }) },
    },
  },
}))

describe("usePageForm", () => {
  beforeEach(() => vi.clearAllMocks())

  const page = { ...makePage("p1", 1), text: "Hi", imagePrompt: "A park" }

  it("is not dirty until a field diverges from the persisted page", () => {
    const { result } = renderHook(() => usePageForm(page))
    expect(result.current.dirty).toBe(false)
    act(() => result.current.onChangeText("Hello there"))
    expect(result.current.dirty).toBe(true)
    act(() => result.current.onChangeText("Hi"))
    expect(result.current.dirty).toBe(false)
  })

  it("debounces edits and saves the full field snapshot", () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => usePageForm(page))
      act(() => result.current.onChangeText("Hello"))
      act(() => result.current.onChangeSteering("softer light"))
      expect(mocks.update).not.toHaveBeenCalled()

      act(() => vi.advanceTimersByTime(600))
      // Only the last scheduled save fires, and it carries every field so the
      // earlier text edit isn't lost.
      expect(mocks.update).toHaveBeenCalledTimes(1)
      expect(mocks.update).toHaveBeenCalledWith({
        pageId: "p1",
        text: "Hello",
        imagePrompt: "A park",
        steeringText: "softer light",
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it("flushes a still-pending debounced save on unmount", () => {
    vi.useFakeTimers()
    try {
      const { result, unmount } = renderHook(() => usePageForm(page))
      act(() => result.current.onChangeText("Hello"))
      expect(mocks.update).not.toHaveBeenCalled()

      // Unmount before the debounce elapses (e.g. Prev/Next remounts by page.id).
      unmount()
      expect(mocks.update).toHaveBeenCalledTimes(1)
      expect(mocks.update).toHaveBeenCalledWith({
        pageId: "p1",
        text: "Hello",
        imagePrompt: "A park",
        steeringText: "",
      })

      // The timer was cleared, so no duplicate save fires afterward.
      act(() => vi.advanceTimersByTime(600))
      expect(mocks.update).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
