import { test, expect } from "@playwright/test"

import { makeUser, signUp } from "../support/auth"

// The landing page ("/") is public. Signed out it points visitors at sign-up /
// sign-in; signed in it links straight into the app. No fixture user here — the
// signed-in case owns its own sign-up so the signed-out assertions stay clean.

test("signed-out landing page routes visitors into auth", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      name: "Personalized social stories, made in minutes",
    })
  ).toBeVisible()

  // Nav "Get started" lands on sign-up.
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Get started" })
    .click()
  await page.waitForURL("**/signup")

  // Nav "Sign in" lands on sign-in.
  await page.goto("/")
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Sign in" })
    .click()
  await page.waitForURL("**/signin")
})

test("signed-in landing page links into the app", async ({ page }) => {
  const user = makeUser()
  await signUp(page, user)

  await page.goto("/")
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Go to app" })
    .click()
  await page.waitForURL("**/stories")
  await expect(
    page.getByRole("heading", { name: "Your stories" })
  ).toBeVisible()
})
