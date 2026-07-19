import { test, expect } from "../support/auth"
import { addCharacter, createStory, parseIntoPages } from "../support/story"

// The parse fixture assigns "Nick" to every content page, so a story whose
// roster contains Nick proves the names survive the round trip into stored
// characterIds; a story with no roster proves the scene-only path.

test("parsing from the characters step assigns the fixture cast to pages", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Nick")
  await parseIntoPages(page, storyId, { hasCharacters: true })

  await page.goto(`/stories/${storyId}/pages`)
  await page.getByRole("button", { name: /Page 1 ·/ }).click()
  await expect(
    page.getByRole("button", { name: "Nick", pressed: true })
  ).toBeVisible()
})

test("parsing without characters takes an explicit confirmation", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)

  await page.getByRole("button", { name: "Parse into pages" }).click()
  await expect(
    page.getByText(/every page will be illustrated without people/i)
  ).toBeVisible()

  // Backing out leaves the story unparsed.
  await page.getByRole("button", { name: "Add characters first" }).click()
  await expect(page.getByText(/Parsed into \d+ pages/)).toHaveCount(0)

  await page.getByRole("button", { name: "Parse into pages" }).click()
  await page.getByRole("button", { name: "Parse anyway" }).click()
  await expect(page.getByText(/Parsed into \d+ pages/)).toBeVisible()

  // Every page is scene-only, and the focus editor says so rather than looking
  // broken.
  await page.goto(`/stories/${storyId}/pages`)
  await page.getByRole("button", { name: /Page 1 ·/ }).click()
  await expect(
    page.getByText("No characters yet — add them in the Characters step.")
  ).toBeVisible()
})

test("the chip row above Generate toggles who is drawn and persists", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Nick")
  await addCharacter(page, "Mom")
  await parseIntoPages(page, storyId, { hasCharacters: true })

  await page.goto(`/stories/${storyId}/pages`)
  await page.getByRole("button", { name: /Page 1 ·/ }).click()

  const mom = page.getByRole("button", { name: "Mom" })
  await expect(mom).toHaveAttribute("aria-pressed", "false")
  await mom.click()
  await expect(mom).toHaveAttribute("aria-pressed", "true")

  // Generating from here requests a page image with the chip selection in
  // force; the focus editor only paints the new variant after a reload, so the
  // reload below doubles as the persistence check for the toggle.
  const generated = page.waitForResponse(
    (response) =>
      response.url().includes("page.generate") && response.status() === 200
  )
  await page.getByRole("button", { name: "Generate image" }).click()
  await generated

  await page.reload()
  await page.getByRole("button", { name: /Page 1 ·/ }).click()
  await expect(
    page.getByRole("img", { name: "Current page image" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Mom" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
})
