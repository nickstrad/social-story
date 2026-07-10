import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"

import { getConfig } from "@/server/config"
import { db } from "@/server/db"

const config = getConfig()

export const auth = betterAuth({
  baseURL: config.auth.url,
  secret: config.auth.secret,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
})
