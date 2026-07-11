import { test, expect } from "../support/auth"
import { SAMPLE_SCRIPT } from "../support/story"

// `test` here is the extended fixture: each test starts signed in as a fresh
// user (see support/auth.ts), so the story list starts empty.

test("shows the empty state before any story exists", async ({ page }) => {
  await expect(page.getByText("No stories yet")).toBeVisible()
})

test("create a story, see it in the list, then delete it", async ({ page }) => {
  await page.goto("/stories/new")
  await page.locator("#new-title").fill("Dentist Day")
  await page.locator("#new-script").fill(SAMPLE_SCRIPT)
  await page.getByRole("button", { name: "Create story" }).click()

  // Creation lands on the script step of the new story.
  await page.waitForURL(/\/stories\/[^/]+\/script$/)

  await page.goto("/stories")
  await expect(page.getByRole("link", { name: "Dentist Day" })).toBeVisible()

  await page.getByRole("button", { name: "Delete story" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()

  await expect(page.getByText("No stories yet")).toBeVisible()
})
