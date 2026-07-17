import { test, expect } from "@playwright/test"

import { makeUser, signIn, signOut, signUp } from "../support/auth"

// Auth flows drive the real Better Auth email+password endpoints against
// Postgres. No fixture user here — each test owns its full sign-up → sign-out →
// sign-in lifecycle.

test("sign up, sign out, then sign back in", async ({ page }) => {
  const user = makeUser()

  await signUp(page, user)
  await expect(
    page.getByRole("heading", { name: "Your stories" })
  ).toBeVisible()

  await signOut(page)
  await signIn(page, user)
})

test("wrong password shows an error", async ({ page }) => {
  const user = makeUser()
  await signUp(page, user)
  await signOut(page)

  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill("wrong-password")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByRole("alert")).toBeVisible()
  // Still on the sign-in page — no session established.
  await expect(page).toHaveURL(/\/signin$/)
})

test("visiting a protected route while signed out redirects to /signin", async ({
  page,
}) => {
  await page.goto("/stories")
  await page.waitForURL("**/signin")
})
