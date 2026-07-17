import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCharacterForm } from "./useCharacterForm"

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock("./useCharacters", () => ({
  useCharacters: () => ({
    create: { mutateAsync: mocks.create, isPending: false },
    update: { mutateAsync: mocks.update, isPending: false },
    invalidate: vi.fn(),
  }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

describe("useCharacterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockResolvedValue({ id: "character-1" })
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ url: "photo" }) })
    )
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    })
  })
  it("blocks invalid submission", async () => {
    const { result } = renderHook(() => useCharacterForm("story"))
    await act(() => result.current.onSubmit())
    expect(result.current.errors.name).toBeTruthy()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("creates a valid character and uploads a selected photo", async () => {
    const { result } = renderHook(() => useCharacterForm("story"))
    act(() => {
      result.current.onChange("name", "Allison")
      result.current.onPickFile(
        new File(["photo"], "photo.png", { type: "image/png" })
      )
    })
    await act(() => result.current.onSubmit())
    expect(mocks.create).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      "/api/upload/photo",
      expect.objectContaining({ method: "POST" })
    )
    expect(result.current.photoPreviewUrl).toBe("blob:preview")
  })

  it("enables photo autofill after selection and applies the suggestions", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appearance: "Long dark hair and round glasses",
        photoDescription: "Standing outside in a yellow jacket.",
      }),
    } as Response)
    const { result } = renderHook(() => useCharacterForm("story"))

    expect(result.current.canAutofill).toBe(false)
    act(() => {
      result.current.onPickFile(
        new File(["photo"], "photo.png", { type: "image/png" })
      )
    })
    expect(result.current.canAutofill).toBe(true)

    await act(() => result.current.onAutofill())

    expect(fetch).toHaveBeenCalledWith(
      "/api/describe/photo",
      expect.objectContaining({ method: "POST" })
    )
    expect(result.current.values).toMatchObject({
      appearance: "Long dark hair and round glasses",
      photoDescription: "Standing outside in a yellow jacket.",
    })
  })
})
