import { test, expect } from "../support/auth"
import type { Page } from "@playwright/test"
import { PrismaClient } from "../../src/generated/prisma"
import { E2E_DATABASE_URL } from "../support/constants"
import { PHOTO, createStory, generateBaseImage } from "../support/story"

async function addLibraryCharacter(page: Page, name: string) {
  await page.getByRole("button", { name: "Add character" }).click()
  await page.locator("#character-name").fill(name)
  await page.locator("#character-photo").setInputFiles(PHOTO)
  await page.getByRole("button", { name: "Auto-fill from photo" }).click()
  await expect(page.locator("#character-appearance")).toHaveValue(
    "Short dark hair and a bright blue shirt"
  )
  await page.getByRole("button", { name: "Save character" }).click()
  await expect(page.getByRole("img", { name })).toBeVisible()
}

async function addCastFromLibrary(
  page: Page,
  storyId: string,
  names: string[]
) {
  await page.goto(`/stories/${storyId}/characters`)
  await page.getByRole("button", { name: "Add from library" }).click()
  for (const name of names) {
    await page
      .locator("label")
      .filter({ hasText: name })
      .getByRole("checkbox")
      .click()
  }
  await page.getByRole("button", { name: "Add selected" }).click()
  for (const name of names) {
    await expect(page.getByRole("img", { name })).toBeVisible()
  }
}

test("reuse saved characters and a matching cast base image", async ({
  page,
}) => {
  await page.goto("/characters")
  await addLibraryCharacter(page, "Sam")
  await addLibraryCharacter(page, "Avery")

  const firstStoryId = await createStory(page, { title: "First story" })
  await addCastFromLibrary(page, firstStoryId, ["Sam", "Avery"])
  await generateBaseImage(page, firstStoryId)

  const secondStoryId = await createStory(page, { title: "Second story" })
  await addCastFromLibrary(page, secondStoryId, ["Sam", "Avery"])
  await page.goto(`/stories/${secondStoryId}/base`)
  await expect(page.getByRole("main").getByText("First story")).toBeVisible()
  await page.getByRole("button", { name: "Reuse base image" }).click()
  await expect(
    page.getByRole("img", { name: "Character reference sheet" })
  ).toBeVisible()

  await page.goto(`/stories/${firstStoryId}/base`)
  await expect(
    page.getByRole("img", { name: "Character reference sheet" })
  ).toBeVisible()
})

test("paginates the table and resets to page 1 when sorting", async ({
  page,
  user,
}) => {
  const prisma = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL })
  try {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    })
    const start = new Date("2026-01-01T00:00:00Z").getTime()
    await prisma.libraryCharacter.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        userId: owner.id,
        name: `Paged character ${String(index + 1).padStart(2, "0")}`,
        createdAt: new Date(start + index * 1_000),
        updatedAt: new Date(start + index * 1_000),
      })),
    })
  } finally {
    await prisma.$disconnect()
  }

  await page.goto("/characters")
  await expect(page.getByText("Paged character 25")).toBeVisible()
  await expect(page.getByText("Paged character 01")).toHaveCount(0)

  await page.getByRole("button", { name: "Table view" }).click()
  const tableRows = page.locator(
    '[data-slot="table-body"] [data-slot="table-row"]'
  )
  await expect(tableRows).toHaveCount(20)
  await page.getByRole("combobox", { name: "Rows per page" }).click()
  await page.getByRole("option", { name: "10", exact: true }).click()
  await expect(tableRows).toHaveCount(10)
  await page.getByRole("combobox", { name: "Rows per page" }).click()
  await page.getByRole("option", { name: "20", exact: true }).click()

  await page.getByRole("button", { name: /Next/ }).click()
  await expect(page.getByText("Page 2")).toBeVisible()
  await expect(page.getByText("Paged character 01")).toBeVisible()

  await page.getByRole("button", { name: /^Name/ }).click()
  await expect(page.getByText("Page 1")).toBeVisible()
  await expect(tableRows.first()).toContainText("Paged character 01")
})
