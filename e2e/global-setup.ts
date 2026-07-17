import { execSync } from "node:child_process"

import { PrismaClient } from "../src/generated/prisma"

import { E2E_DATABASE_URL } from "./support/constants"

// Prepares the (already-running) E2E Postgres: applies migrations, then wipes
// every table so each run starts from a clean, deterministic baseline. The
// container itself is started/stopped by scripts/e2e.sh — this only owns schema
// and data. `scripts/e2e.sh` removes the volume between runs, so migrate deploy
// normally lands on an empty database; the truncate covers a reused container.
const TABLES = [
  "Asset",
  "PageImage",
  "Page",
  "Task",
  "Rule",
  "Character",
  "Story",
  "Session",
  "Account",
  "Verification",
  "User",
]

export default async function globalSetup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  })

  const prisma = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL })
  try {
    const list = TABLES.map((table) => `"${table}"`).join(", ")
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`
    )
  } finally {
    await prisma.$disconnect()
  }
}
