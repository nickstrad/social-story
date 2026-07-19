import { expect, makeUser, signOut, signUp, test } from "../support/auth"
import {
  addCharacter,
  addCharacterPhoto,
  createStory,
  generateBaseImage,
  parseIntoPages,
} from "../support/story"

test("generate all page images and export a valid PDF", async ({ page }) => {
  const storyId = await createStory(page)

  // Establish the real recurring character, including the user-provided photo,
  // then build the canned reference sheet through the normal task flow.
  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Nick")
  await addCharacterPhoto(page, "Nick")
  await generateBaseImage(page, storyId)
  const imageUrl = await page
    .getByRole("img", { name: "Character reference sheet" })
    .getAttribute("src")
  expect(imageUrl).toMatch(/^\/api\/me\/assets\//)

  // Parse through the real task handler using the canned LLM JSON fixture.
  await parseIntoPages(page, storyId, { hasCharacters: true })

  // Run every local image/caption task against the checked-in PNG fixture.
  await page.goto(`/stories/${storyId}/pages`)
  await page.getByRole("button", { name: "Select all" }).click()
  await page.getByRole("button", { name: "Generate selected (4)" }).click()
  await expect(page.getByRole("img")).toHaveCount(4)

  // Export uses the real local pdf-lib assembler and local E2E storage.
  await page.goto(`/stories/${storyId}/export`)
  await expect(page.getByText("4 pages ready to export.")).toBeVisible()
  await page.getByRole("button", { name: "Export PDF" }).click()

  const download = page.getByRole("link", { name: "Download PDF" })
  await expect(download).toBeVisible()
  const href = await download.getAttribute("href")
  expect(href).toBeTruthy()
  expect(href).toMatch(/^\/api\/me\/assets\//)

  // Exercise the browser-facing storage route, including its PDF media type,
  // and verify the returned artifact has a genuine PDF header.
  const response = await page.request.get(href!)
  expect(response.ok()).toBe(true)
  expect(response.headers()["content-type"]).toBe("application/pdf")
  expect((await response.body()).subarray(0, 4).toString("latin1")).toBe("%PDF")

  const imageResponse = await page.request.get(imageUrl!)
  expect(imageResponse.ok()).toBe(true)
  expect(imageResponse.headers()["content-type"]).toBe("image/png")
  const etag = imageResponse.headers().etag
  expect(etag).toBeTruthy()
  const cachedImageResponse = await page.request.get(imageUrl!, {
    headers: { "If-None-Match": etag },
  })
  expect(cachedImageResponse.status()).toBe(304)
  expect(cachedImageResponse.headers().etag).toBe(etag)

  await signOut(page)
  expect((await page.request.get(href!)).status()).toBe(401)
  expect((await page.request.get(imageUrl!)).status()).toBe(401)

  await signUp(page, makeUser())
  expect((await page.request.get(href!)).status()).toBe(404)
  expect((await page.request.get(imageUrl!)).status()).toBe(404)
})
