import { expect, type Page } from "@playwright/test"

export const SAMPLE_SCRIPT =
  "Sam visits the dentist. The dentist counts Sam's teeth. Then Sam goes home."

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
