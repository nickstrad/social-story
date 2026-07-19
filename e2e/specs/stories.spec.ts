import { test, expect } from "../support/auth"
import { createStory, parseIntoPages } from "../support/story"

// `test` here is the extended fixture: each test starts signed in as a fresh
// user (see support/auth.ts), so the story list starts empty.

test("shows the empty state before any story exists", async ({ page }) => {
  await expect(page.getByText("No stories yet")).toBeVisible()
})

test("create a story, see it in the list, then delete it", async ({ page }) => {
  const storyId = await createStory(page, { title: "Dentist Day" })

  // Exercise the restrictive PageImage-to-Asset link before deleting the story.
  await parseIntoPages(page, storyId)
  await page.goto(`/stories/${storyId}/pages`)
  await page.getByRole("button", { name: "Select all" }).click()
  await page.getByRole("button", { name: "Generate selected (4)" }).click()
  await expect(page.getByRole("img")).toHaveCount(4)

  await page.goto("/stories")
  // Scoped to main: the sidebar's recent-stories list carries the same title,
  // so an unscoped locator now matches two links.
  await expect(
    page.getByRole("main").getByRole("link", { name: "Dentist Day" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Delete story" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()

  await expect(page.getByText("No stories yet")).toBeVisible()
})

test("persists grid and table view choices across reloads", async ({
  page,
}) => {
  await createStory(page, { title: "Persistent view" })
  await page.goto("/stories")

  await page.getByRole("button", { name: "Table view" }).click()
  await expect(page.locator('[data-slot="table"]')).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-slot="table"]')).toBeVisible()

  await page.getByRole("button", { name: "Grid view" }).click()
  await expect(page.locator('[data-slot="table"]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('[data-slot="table"]')).toHaveCount(0)
  await expect(
    page.getByRole("main").getByRole("link", { name: "Persistent view" })
  ).toBeVisible()
})
