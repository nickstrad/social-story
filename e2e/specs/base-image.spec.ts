import { test, expect } from "../support/auth"
import { addCharacter, createStory } from "../support/story"

test("generate a base image and see it render", async ({ page }) => {
  const storyId = await createStory(page)
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Sam")

  await page.goto(`/stories/${storyId}/base`)
  await page.getByRole("button", { name: "Generate base image" }).click()

  // Immediate dispatcher runs the task inline; the fake image generator returns
  // a byte-stable PNG served from the fake-storage route.
  await expect(page.getByText("Complete")).toBeVisible()
  await expect(
    page.getByRole("img", { name: "Character reference sheet" })
  ).toBeVisible()

  // Regenerate path: the button flips label once an image exists.
  await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible()
})
