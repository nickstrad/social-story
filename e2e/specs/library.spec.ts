import { test, expect } from "../support/auth"
import type { Page } from "@playwright/test"
import { PHOTO, createStory, generateBaseImage } from "../support/story"

async function addLibraryCharacter(page: Page, name: string) {
  await page.getByRole("button", { name: "Add character" }).click()
  await page.locator("#character-name").fill(name)
  await page.locator("#character-photo").setInputFiles(PHOTO)
  await page.getByRole("button", { name: "Auto-fill from photo" }).click()
  await expect(page.locator("#character-appearance")).toHaveValue(
    "Short dark hair and a bright blue shirt"
  )
  await page.getByRole("button", { name: "Save character" }).click()
  await expect(page.getByRole("img", { name })).toBeVisible()
}

async function addCastFromLibrary(
  page: Page,
  storyId: string,
  names: string[]
) {
  await page.goto(`/stories/${storyId}/characters`)
  await page.getByRole("button", { name: "Add from library" }).click()
  for (const name of names) {
    await page
      .locator("label")
      .filter({ hasText: name })
      .getByRole("checkbox")
      .click()
  }
  await page.getByRole("button", { name: "Add selected" }).click()
  for (const name of names) {
    await expect(page.getByRole("img", { name })).toBeVisible()
  }
}

test("reuse saved characters and a matching cast base image", async ({
  page,
}) => {
  await page.goto("/characters")
  await addLibraryCharacter(page, "Sam")
  await addLibraryCharacter(page, "Avery")

  const firstStoryId = await createStory(page, { title: "First story" })
  await addCastFromLibrary(page, firstStoryId, ["Sam", "Avery"])
  await generateBaseImage(page, firstStoryId)

  const secondStoryId = await createStory(page, { title: "Second story" })
  await addCastFromLibrary(page, secondStoryId, ["Sam", "Avery"])
  await page.goto(`/stories/${secondStoryId}/base`)
  await expect(page.getByRole("main").getByText("First story")).toBeVisible()
  await page.getByRole("button", { name: "Reuse base image" }).click()
  await expect(
    page.getByRole("img", { name: "Character reference sheet" })
  ).toBeVisible()

  await page.goto(`/stories/${firstStoryId}/base`)
  await expect(
    page.getByRole("img", { name: "Character reference sheet" })
  ).toBeVisible()
})
