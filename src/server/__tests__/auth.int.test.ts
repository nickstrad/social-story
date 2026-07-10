// @vitest-environment node

import { randomUUID } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import "dotenv/config"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabase)("Better Auth", () => {
  let auth: typeof import("@/server/auth").auth
  let getServerSession: typeof import("@/server/auth-session").getServerSession
  let db: PrismaClient
  const email = `auth-${randomUUID()}@example.com`
  const password = "correct-horse-battery-staple"

  beforeAll(async () => {
    ;({ auth } = await import("@/server/auth"))
    ;({ getServerSession } = await import("@/server/auth-session"))
    ;({ db } = await import("@/server/db"))
  })

  afterAll(async () => {
    if (!db) return
    await db.user.deleteMany({ where: { email } })
    await db.$disconnect()
  })

  it("signs up, signs in, and resolves the session", async () => {
    await auth.api.signUpEmail({
      body: { name: "Auth Test", email, password },
    })

    expect(await db.user.findUnique({ where: { email } })).not.toBeNull()

    const signedIn = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    })
    const cookie = signedIn.headers.get("set-cookie")
    expect(cookie).toBeTruthy()

    const session = await getServerSession(new Headers({ cookie: cookie! }))
    expect(session?.user.email).toBe(email)
  })
})
