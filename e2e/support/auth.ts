import { test as base, expect, type Page } from "@playwright/test"

export type TestUser = { name: string; email: string; password: string }

let seq = 0

/** A unique test user; unique emails keep specs isolated on the shared DB. */
export function makeUser(): TestUser {
  seq += 1
  return {
    name: "E2E User",
    email: `e2e+${Date.now()}-${seq}@example.com`,
    password: "Password123!",
  }
}

/** Drive the real /signup form; lands authenticated on /stories. */
export async function signUp(page: Page, user: TestUser): Promise<void> {
  await page.goto("/signup")
  await page.getByLabel("Name").fill(user.name)
  await page.getByLabel("Email").fill(user.email)
  // Exact match: the signup form also has a "Confirm password" field.
  await page.getByLabel("Password", { exact: true }).fill(user.password)
  await page.getByLabel("Confirm password").fill(user.password)
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL("**/stories")
  // The app redirects client-side after Better Auth returns. Waiting for the
  // destination URL alone can release the fixture while that transition is
  // still settling, so an immediate page.goto() may abort it and lose the
  // authenticated destination state. The empty-state query proves both the
  // session and the client tRPC tree are ready without relying on a sleep.
  await expect(page.getByText("No stories yet")).toBeVisible()
}

/** Drive the real sign-in form; lands authenticated on /stories. */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/signin")
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(user.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("**/stories")
  await expect(
    page.getByRole("heading", { name: "Your stories" })
  ).toBeVisible()
}

/** Sign out through the shared account menu and wait for the public route. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open account menu" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await page.waitForURL("**/signin")
}

// `user` fixture signs a fresh account in before the test body and exposes its
// credentials (some specs re-sign-in with them). Each test gets its own browser
// context, so being authenticated here carries through the whole test.
export const test = base.extend<{ user: TestUser }>({
  user: [
    async ({ page }, use) => {
      const user = makeUser()
      await signUp(page, user)
      await use(user)
    },
    { auto: true },
  ],
})

export { expect }
