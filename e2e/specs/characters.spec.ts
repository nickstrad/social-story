import { test, expect } from "../support/auth"
import { PHOTO, addCharacter, createStory } from "../support/story"

test("add, edit, and delete a character", async ({ page }) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)

  await addCharacter(page, "Sam")

  await page.getByRole("button", { name: "Edit Sam" }).click()
  await page.locator("#character-name").fill("Samuel")
  await page.getByRole("button", { name: "Save character" }).click()
  await expect(page.getByRole("button", { name: "Edit Samuel" })).toBeVisible()

  await page.getByRole("button", { name: "Delete Samuel" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(
    page.getByText("Start by adding the main character.")
  ).toBeVisible()
})

test("add and delete a visual rule", async ({ page }) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Sam")

  await page.getByRole("button", { name: "Add rule" }).click()
  // Freeform needs no character selection — keeps this test independent of the
  // multi-character rule kinds.
  await page.getByRole("button", { name: "Freeform" }).click()
  await page.locator("#rule-text").fill("Keep the mood calm and gentle.")
  await page.getByRole("button", { name: "Save rule" }).click()

  await expect(page.getByText("Keep the mood calm and gentle.")).toBeVisible()

  await page.getByRole("button", { name: "Delete rule" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByText("No visual rules yet.")).toBeVisible()
})

test("upload a character photo through the real upload route", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Sam")

  await page.getByRole("button", { name: "Edit Sam" }).click()
  await page.locator("#character-photo").setInputFiles(PHOTO)
  await page.getByRole("button", { name: "Save character" }).click()

  // Photo is re-encoded by sharp and served from the fake-storage route; the
  // card renders it via next/image with the character name as alt text.
  const photo = page.getByRole("img", { name: "Sam" })
  await expect(photo).toBeVisible()
})

test("auto-fill becomes available after attaching a photo", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)
  await page.getByRole("button", { name: "Add character" }).click()

  await expect(page.getByText("Start with a clear photo")).toBeVisible()
  const autofill = page.getByRole("button", { name: "Auto-fill from photo" })
  await expect(autofill).toBeDisabled()

  await page.locator("#character-photo").setInputFiles(PHOTO)
  await expect(autofill).toBeEnabled()
  await autofill.click()

  await expect(page.locator("#character-appearance")).toHaveValue(
    "Short dark hair and a bright blue shirt"
  )
  await expect(page.locator("#character-photoDescription")).toHaveValue(
    "A smiling person outdoors, wearing a bright blue shirt."
  )
})

test("the base image step unlocks once a character exists", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)

  // Before any character, Base image is a disabled step (a span, not a link).
  await expect(page.getByRole("link", { name: "Base image" })).toHaveCount(0)

  await addCharacter(page, "Sam")
  await expect(page.getByRole("link", { name: /^3 Base image$/ })).toBeVisible()
})
