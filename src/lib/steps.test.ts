import { describe, expect, it } from "vitest"
import { deriveStepStates, type StoryStepInput } from "./steps"

const base: StoryStepInput = {
  status: "DRAFT",
  script: "",
  charactersCount: 0,
  baseImageUrl: null,
  pagesCount: 0,
  pagesWithImageCount: 0,
}

function states(input: Partial<StoryStepInput>) {
  return Object.fromEntries(
    deriveStepStates({ ...base, ...input }).map((step) => [step.key, step])
  )
}

describe("deriveStepStates", () => {
  it("only enables the script step on a fresh draft", () => {
    const steps = states({})
    expect(steps.script).toMatchObject({ done: false, enabled: true })
    expect(steps.characters.enabled).toBe(false)
    expect(steps.base.enabled).toBe(false)
    expect(steps.pages.enabled).toBe(false)
    expect(steps.export.enabled).toBe(false)
  })

  it("marks script done and enables characters once a script is entered", () => {
    const steps = states({ script: "Once upon a time" })
    expect(steps.script.done).toBe(true)
    expect(steps.characters.enabled).toBe(true)
  })

  it("enables base image and marks characters done with a cast", () => {
    const steps = states({ script: "s", charactersCount: 2 })
    expect(steps.characters.done).toBe(true)
    expect(steps.base.enabled).toBe(true)
    expect(steps.base.done).toBe(false)
  })

  it("enables pages once the story is parsed", () => {
    const steps = states({ script: "s", status: "PARSED", pagesCount: 20 })
    expect(steps.pages.enabled).toBe(true)
    expect(steps.pages.done).toBe(false)
  })

  it("marks base and pages done and enables export with generated art", () => {
    const steps = states({
      script: "s",
      status: "PARSED",
      charactersCount: 1,
      baseImageUrl: "https://blob/base.png",
      pagesCount: 20,
      pagesWithImageCount: 5,
    })
    expect(steps.base.done).toBe(true)
    expect(steps.pages.done).toBe(true)
    expect(steps.export.enabled).toBe(true)
  })

  it("marks export done when the story is ready", () => {
    const steps = states({
      script: "s",
      status: "READY",
      pagesCount: 20,
      pagesWithImageCount: 20,
    })
    expect(steps.export.done).toBe(true)
  })
})
