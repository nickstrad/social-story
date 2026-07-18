import { expect, test } from "../support/auth"
import { createStory } from "../support/story"

const PAGE_IMAGE = "e2e/fixtures/images/page-1.png"

test("uploads a page image and confirms before adding another variant", async ({
  page,
}) => {
  const storyId = await createStory(page)
  await page.getByRole("button", { name: "Parse into pages" }).click()
  await expect(page.getByText(/Parsed into 4 pages/)).toBeVisible()

  await page.goto(`/stories/${storyId}/pages`)
  await page.getByRole("button", { name: /Page 1 ·/ }).click()
  await expect(page.getByRole("heading", { name: "Page 1" })).toBeVisible()

  const input = page.getByLabel("Upload page image")
  await input.setInputFiles(PAGE_IMAGE)
  await expect(
    page.getByRole("img", { name: "Current page image" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { pressed: true }).getByText("Uploaded")
  ).toBeVisible()

  await input.setInputFiles(PAGE_IMAGE)
  await expect(page.getByText("Use this image for this page?")).toBeVisible()
  await expect(
    page.getByText("Your previous versions stay in the strip.")
  ).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByText("Use this image for this page?")).toHaveCount(0)
})
