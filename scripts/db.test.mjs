import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  applyEnvironmentOptions,
  buildPrismaArguments,
  describeDatabase,
  parseArguments,
  resolveDatabaseUrl,
  validateOptions,
} from "./db.mjs"

test("parses command and safety options", () => {
  assert.deepEqual(
    parseArguments([
      "reset",
      "--target",
      "prod",
      "--env-file",
      ".env.production",
      "--confirm",
      "app",
      "--allow-production-reset",
    ]),
    {
      command: "reset",
      target: "prod",
      env_file: ".env.production",
      confirm: "app",
      allow_production_reset: true,
    }
  )
})

test("reads only DATABASE_URL from a dotenv file", () => {
  const directory = mkdtempSync(join(tmpdir(), "social-story-db-"))
  const envFile = join(directory, ".env")
  writeFileSync(
    envFile,
    'OTHER_SECRET="do-not-use"\nDATABASE_URL="postgresql://user:p%40ss@db.example.com/app"\n'
  )

  assert.equal(
    resolveDatabaseUrl({ env_file: envFile }, {}),
    "postgresql://user:p%40ss@db.example.com/app"
  )
})

test("accepts Make variables through the environment without shell interpolation", () => {
  assert.deepEqual(
    applyEnvironmentOptions(
      { command: "push" },
      {
        TARGET: "prod",
        DB_URL: "postgresql://user:p$word@db.example.com/app",
        ACCEPT_DATA_LOSS: "1",
        ALLOW_PRODUCTION_PUSH: "true",
      }
    ),
    {
      command: "push",
      target: "prod",
      url: "postgresql://user:p$word@db.example.com/app",
      env_file: undefined,
      name: undefined,
      confirm: undefined,
      allow_production_reset: false,
      accept_data_loss: true,
      allow_production_push: true,
    }
  )
})

test("describes a database without credentials or query parameters", () => {
  assert.deepEqual(
    describeDatabase(
      "postgresql://user:secret@db.example.com:5432/social_story?sslmode=require"
    ),
    { database: "social_story", display: "db.example.com:5432/social_story" }
  )
})

test("requires the database name to confirm a reset", () => {
  assert.throws(
    () =>
      validateOptions(
        { command: "reset", target: "dev", confirm: "wrong" },
        "social_story"
      ),
    /--confirm social_story/
  )
})

test("adds a second opt-in for production reset", () => {
  assert.throws(
    () =>
      validateOptions(
        { command: "reset", target: "prod", confirm: "social_story" },
        "social_story"
      ),
    /--allow-production-reset/
  )

  assert.doesNotThrow(() =>
    validateOptions(
      {
        command: "reset",
        target: "prod",
        confirm: "social_story",
        allow_production_reset: true,
      },
      "social_story"
    )
  )
})

test("uses deploy instead of migrate dev for production", () => {
  assert.throws(
    () => validateOptions({ command: "migrate-dev", target: "prod" }, "app"),
    /use deploy/
  )
})

test("builds explicit Prisma arguments", () => {
  assert.deepEqual(
    buildPrismaArguments({ command: "migrate-dev", name: "add_index" }),
    ["migrate", "dev", "--name", "add_index"]
  )
  assert.deepEqual(
    buildPrismaArguments({ command: "push", accept_data_loss: true }),
    ["db", "push", "--accept-data-loss"]
  )
})
