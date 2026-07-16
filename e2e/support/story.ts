import { expect, type Page } from "@playwright/test"

export const SAMPLE_SCRIPT =
  "Sam visits the dentist. The dentist counts Sam's teeth. Then Sam goes home."

/** Checked-in JPEG used wherever a spec needs a real character photo upload. */
export const PHOTO = "e2e/fixtures/images/character-photo.jpg"

/**
 * Create a story via the real /stories/new form and wait until the wizard lands
 * on its script step. Returns the new story id parsed from the URL.
 */
export async function createStory(
  page: Page,
  { title, script = SAMPLE_SCRIPT }: { title?: string; script?: string } = {}
): Promise<string> {
  await page.goto("/stories/new")
  if (title) await page.locator("#new-title").fill(title)
  await page.locator("#new-script").fill(script)
  await page.getByRole("button", { name: "Create story" }).click()

  await page.waitForURL(/\/stories\/[^/]+\/script$/)
  const match = page.url().match(/\/stories\/([^/]+)\/script/)
  expect(match).not.toBeNull()
  return match![1]
}

/** Add a character through the Characters step dialog and wait for its card. */
export async function addCharacter(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add character" }).click()
  await page.locator("#character-name").fill(name)
  await page.getByRole("button", { name: "Save character" }).click()
  await expect(page.getByRole("button", { name: `Edit ${name}` })).toBeVisible()
}

/**
 * Attach the fixture photo to an existing character via the real upload route.
 * Must already be on that story's Characters step. The photo is re-encoded by
 * sharp and served back from fake storage, so the card's `<img alt={name}>`
 * appearing is what proves the round-trip finished.
 */
export async function addCharacterPhoto(
  page: Page,
  name: string
): Promise<void> {
  await page.getByRole("button", { name: `Edit ${name}` }).click()
  await page.locator("#character-photo").setInputFiles(PHOTO)
  await page.getByRole("button", { name: "Save character" }).click()
  await expect(page.getByRole("img", { name })).toBeVisible()
}

/** Run the base-image task to completion via the Base image step. */
export async function generateBaseImage(
  page: Page,
  storyId: string
): Promise<void> {
  await page.goto(`/stories/${storyId}/base`)
  await page.getByRole("button", { name: "Generate base image" }).click()
  await expect(
    page.getByRole("img", { name: "Character reference sheet" })
  ).toBeVisible()
}
