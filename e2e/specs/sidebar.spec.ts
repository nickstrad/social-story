import type { Page } from "@playwright/test"

import { test, expect } from "../support/auth"
import {
  addCharacter,
  addCharacterPhoto,
  createStory,
  generateBaseImage,
} from "../support/story"

// The sidebar is a landmark named "Main", which keeps these locators clear of
// the identically-named links rendered by the story list and steps nav.
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Main" })

test("sidebar links reach stories, new story, and artifacts", async ({
  page,
}) => {
  const nav = sidebar(page)
  await expect(nav.getByText("No recent stories")).toBeVisible()

  await nav.getByRole("link", { name: "Artifacts" }).click()
  await page.waitForURL("**/artifacts")
  await expect(page.getByText("No artifacts yet")).toBeVisible()

  await nav.getByRole("link", { name: "New story" }).click()
  await page.waitForURL("**/stories/new")

  await nav.getByRole("link", { name: "All stories" }).click()
  await page.waitForURL("**/stories")
  await expect(page.getByText("No stories yet")).toBeVisible()
})

test("a new story appears in the sidebar and links back to itself", async ({
  page,
}) => {
  const storyId = await createStory(page, { title: "Dentist Day" })

  const link = sidebar(page).getByRole("link", { name: "Dentist Day" })
  await expect(link).toBeVisible()

  // Navigate away, then use the sidebar entry to come back to the story.
  await page.goto("/artifacts")
  await sidebar(page).getByRole("link", { name: "Dentist Day" }).click()
  await page.waitForURL(`**/stories/${storyId}/script`)
})

test("collapsing the sidebar hides it and the trigger restores it", async ({
  page,
}) => {
  await expect(sidebar(page)).toBeVisible()

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(sidebar(page)).not.toBeInViewport()

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(sidebar(page)).toBeInViewport()
})

test("artifacts page lists a character photo and the base image", async ({
  page,
}) => {
  const storyId = await createStory(page, { title: "Dentist Day" })

  await page.goto(`/stories/${storyId}/characters`)
  await addCharacter(page, "Nick")
  await addCharacterPhoto(page, "Nick")
  await generateBaseImage(page, storyId)

  await sidebar(page).getByRole("link", { name: "Artifacts" }).click()
  await page.waitForURL("**/artifacts")

  await expect(page.getByRole("img", { name: "Nick photo" })).toBeVisible()
  await expect(
    page.getByRole("img", { name: "Character reference sheet" })
  ).toBeVisible()
  const artifactImages = page.getByRole("main").getByRole("img")
  await expect(artifactImages).toHaveCount(2)
  const imageAttributes = await artifactImages.evaluateAll((images) =>
    images.map((image) => ({
      src: image.getAttribute("src"),
      alt: image.getAttribute("alt"),
    }))
  )
  expect(imageAttributes.map(({ alt }) => alt)).toEqual([
    "Character reference sheet",
    "Nick photo",
  ])
  expect(
    imageAttributes.every(({ src }) => /^\/api\/me\/assets\//.test(src ?? ""))
  ).toBe(true)

  const originalHrefs = await page
    .getByRole("main")
    .getByRole("link", { name: "Open original" })
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
  expect(originalHrefs).toHaveLength(2)
  expect(
    originalHrefs.every((href) => /^\/api\/me\/assets\//.test(href ?? ""))
  ).toBe(true)
  const mainHtml = await page.getByRole("main").innerHTML()
  expect(mainHtml).not.toContain("blob.vercel-storage.com")
  expect(mainHtml).not.toContain(`/stories/${storyId}/photos/`)
  expect(mainHtml).not.toContain(`/stories/${storyId}/base.png`)
  // Every artifact is attributed to the story that produced it. Scoped to main
  // so the sidebar's own "Dentist Day" entry doesn't count toward this.
  await expect(page.getByRole("main").getByText("Dentist Day")).toHaveCount(2)

  // The tile click-through returns to the step that produced the artifact.
  await page
    .getByRole("main")
    .getByRole("link", { name: "Character reference sheet" })
    .click()
  await page.waitForURL(`**/stories/${storyId}/base`)
})
