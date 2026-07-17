import { test, expect } from "../support/auth"
import { createStory } from "../support/story"

test("edits to title and script persist across a reload", async ({ page }) => {
  await createStory(page)

  // Debounced autosave (800ms) — wait for the persisted writes before reloading.
  const titleSaved = page.waitForResponse(
    (r) => r.url().includes("story.updateTitle") && r.status() === 200
  )
  await page.locator("#story-title").fill("Renamed story")
  await titleSaved

  const scriptSaved = page.waitForResponse(
    (r) => r.url().includes("story.updateScript") && r.status() === 200
  )
  await page.locator("#story-script").fill("A brand new script body.")
  await scriptSaved

  await page.reload()
  await expect(page.locator("#story-title")).toHaveValue("Renamed story")
  await expect(page.locator("#story-script")).toHaveValue(
    "A brand new script body."
  )
})

test("parsing the script reaches DONE and reports the page count", async ({
  page,
}) => {
  await createStory(page)

  await page.getByRole("button", { name: "Parse into pages" }).click()

  // Immediate dispatcher runs the parse task inline, so the polling badge should
  // reach a terminal Complete state and the parsed summary should appear.
  await expect(page.getByText("Complete")).toBeVisible()
  await expect(page.getByText(/Parsed into \d+ pages/)).toBeVisible()
})

test("the footer shows artifacts and continues to characters", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.getByRole("button", { name: "Parse into pages" }).click()
  await expect(page.getByText("Complete")).toBeVisible()

  await page.getByRole("button", { name: "View artifacts" }).click()
  const artifacts = page.getByRole("dialog", { name: "Story artifacts" })
  await expect(artifacts).toBeVisible()
  await expect(artifacts.getByText("Story script")).toBeVisible()
  await expect(artifacts.getByText(/Story pages · \d+/)).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("link", { name: "Continue to Characters" }).click()
  await expect(page).toHaveURL(`/stories/${storyId}/characters`)
})

test("the characters step is reachable once the script has content", async ({
  page,
}) => {
  await createStory(page)
  // A story always starts with a non-empty script, so Characters is enabled.
  await expect(page.getByRole("link", { name: /^2 Characters$/ })).toBeVisible()
})
