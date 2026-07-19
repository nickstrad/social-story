import { expect, test } from "../support/auth"
import {
  PHOTO,
  addCharacter,
  createStory,
  generateBaseImage,
  parseIntoPages,
} from "../support/story"

test("save, personalize, and illustrate a reusable story template", async ({
  page,
}) => {
  const storyId = await createStory(page, { title: "Clinic visit" })
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Nick")
  await addCharacter(page, "Sibling")

  await parseIntoPages(page, storyId, { hasCharacters: true })

  await page.goto(`/stories/${storyId}/export`)
  await page.getByRole("button", { name: "Convert to template" }).click()
  await page.waitForURL(/\/stories\/[^/]+\/characters\?template=1$/)

  await page.getByRole("button", { name: "Edit Sibling" }).click()
  await page.getByRole("switch", { name: "Optional slot" }).click()
  await page.getByRole("button", { name: "Save character" }).click()
  await expect(
    page.getByRole("button", { name: "Save character" })
  ).toHaveCount(0)

  await page.goto("/templates")
  await page.getByRole("button", { name: "Use template" }).click()
  const dialog = page.getByRole("dialog", { name: "Use template" })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Name").first().fill("Riley")
  await dialog.getByRole("button", { name: "Create story" }).click()
  await page.waitForURL(/\/stories\/[^/]+\/characters$/)
  const instanceId = page.url().match(/\/stories\/([^/]+)\/characters/)![1]

  await expect(page.getByRole("button", { name: "Edit Riley" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit Sibling" })).toHaveCount(
    0
  )
  await page.getByRole("button", { name: "Edit Riley" }).click()
  await page.locator("#character-photo").setInputFiles(PHOTO)
  await page.getByRole("button", { name: "Save character" }).click()
  await expect(page.getByRole("img", { name: "Riley" })).toBeVisible()

  await generateBaseImage(page, instanceId)
  await page.goto(`/stories/${instanceId}/pages`)
  await expect(page.getByText(/Riley sits calmly/)).toBeVisible()
  await page.getByRole("button", { name: "Select all" }).click()
  await page.getByRole("button", { name: "Generate selected (4)" }).click()
  await expect(page.getByRole("img")).toHaveCount(4)
})
