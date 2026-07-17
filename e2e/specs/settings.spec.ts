import { expect, signIn, signOut, test } from "../support/auth"
import { BASE_URL } from "../support/constants"

test("account menu shows identity and opens settings", async ({
  page,
  user,
}) => {
  await page.getByRole("button", { name: "Open account menu" }).click()

  await expect(page.getByText(user.email)).toBeVisible()
  await page.getByRole("menuitem", { name: "Settings" }).click()
  await page.waitForURL("**/settings")

  await expect(
    page.getByRole("heading", { name: "Settings", level: 1 })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Change password", level: 2 })
  ).toBeVisible()
})

test("changes the password and revokes other sessions", async ({
  browser,
  page,
  user,
}) => {
  const newPassword = "NewPassword456!"
  const otherContext = await browser.newContext({ baseURL: BASE_URL })
  const otherPage = await otherContext.newPage()

  try {
    await signIn(otherPage, user)
    await page.goto("/settings")

    const currentPassword = page.getByLabel("Current password", { exact: true })
    const nextPassword = page.getByLabel("New password", { exact: true })
    const confirmation = page.getByLabel("Confirm new password", {
      exact: true,
    })
    const updatePassword = page.getByRole("button", {
      name: "Update password",
    })

    await currentPassword.fill(user.password)
    await nextPassword.fill(newPassword)
    await confirmation.fill("DoesNotMatch789!")
    await updatePassword.click()
    await expect(page.getByText("Passwords do not match")).toBeVisible()

    await currentPassword.fill("WrongPassword123!")
    await confirmation.fill(newPassword)
    await updatePassword.click()
    await expect(page.getByText("Current password is incorrect")).toBeVisible()

    await currentPassword.fill(user.password)
    await updatePassword.click()
    await expect(
      page.getByRole("alert").getByText("Password updated")
    ).toBeVisible()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(currentPassword).toHaveValue("")
    await expect(nextPassword).toHaveValue("")
    await expect(confirmation).toHaveValue("")

    await otherPage.goto(`${BASE_URL}/stories`)
    await otherPage.waitForURL("**/signin")

    await signOut(page)

    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page).toHaveURL(/\/signin$/)

    await signIn(page, { ...user, password: newPassword })
  } finally {
    await otherContext.close()
  }
})
