import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CharacterForm } from "./CharacterForm"

const values = {
  name: "",
  role: "",
  age: "",
  appearance: "",
  photoDescription: "",
}

describe("CharacterForm", () => {
  it("accepts a dropped photo through the same file callback", () => {
    const onPickFile = vi.fn()
    render(
      <CharacterForm
        values={values}
        errors={{}}
        photoPreviewUrl=""
        uploadState="idle"
        autofillState="idle"
        canAutofill={false}
        onChange={vi.fn()}
        onPickFile={onPickFile}
        onAutofill={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    const file = new File(["photo"], "photo.png", { type: "image/png" })

    fireEvent.drop(
      screen.getByText("Drop a photo or choose a file").closest("label")!,
      { dataTransfer: { files: [file] } }
    )

    expect(onPickFile).toHaveBeenCalledWith(file)
    expect(
      screen.getByRole("button", { name: "Auto-fill from photo" })
    ).toBeDisabled()
  })
})
