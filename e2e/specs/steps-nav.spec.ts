import { test, expect } from "../support/auth"
import { addCharacter, createStory } from "../support/story"

// Walks `deriveStepStates` gating end-to-end through the real UI. Enabled steps
// render as links; disabled steps render as plain spans (0 links). Pages/Export
// have their own screens now, but stay locked until their upstream work exists.

test("steps unlock in order as their prerequisites are satisfied", async ({
  page,
}) => {
  const storyId = await createStory(page)

  // Fresh story: script has content, so Characters is enabled; the rest locked.
  await expect(page.getByRole("link", { name: /^2 Characters$/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "Base image" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Pages" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Export" })).toHaveCount(0)

  // Adding a character unlocks Base image.
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Sam")
  await expect(page.getByRole("link", { name: /^3 Base image$/ })).toBeVisible()

  // Parsing the script unlocks Pages (parsed status + page count > 0).
  await page.goto(`/stories/${storyId}/script`)
  await page.getByRole("button", { name: "Parse into pages" }).click()
  await expect(page.getByText("Complete")).toBeVisible()
  await expect(page.getByRole("link", { name: /^4 Pages$/ })).toBeVisible()

  // Export stays locked until pages have generated images (a later flow).
  await expect(page.getByRole("link", { name: "Export" })).toHaveCount(0)
})
