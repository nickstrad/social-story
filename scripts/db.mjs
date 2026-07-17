#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import dotenv from "dotenv"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, "..")

const help = `Database operations

Usage:
  npm run db -- <command> --target <dev|prod> [database source] [options]

Database source (choose one):
  --url <url>             Explicit PostgreSQL DATABASE_URL
  --env-file <path>       File containing DATABASE_URL
  DB_URL=<url>            Make variable equivalent to --url
  DB_ENV_FILE=<path>      Make variable equivalent to --env-file
  DATABASE_URL=<url>      Inherited environment variable

Commands:
  status                  Show migration status
  deploy                  Apply pending migrations (the production-safe command)
  migrate-dev             Create/apply a development migration; use --name <name>
  reset                   Wipe the database and replay all migrations
  push                    Push the Prisma schema without migrations
  pull                    Introspect the database into prisma/schema.prisma
  studio                  Open Prisma Studio
  generate                Generate the Prisma client
  validate                Validate prisma/schema.prisma
  format                  Format prisma/schema.prisma

Safety options:
  --confirm <database>            Required for reset; must match the URL database name
  --allow-production-reset        Also required to reset a --target prod database
  --accept-data-loss              Pass Prisma's data-loss opt-in to db push
  --allow-production-push         Also required to push to a --target prod database

Examples:
  npm run db -- status --target dev --url 'postgresql://...'
  npm run db -- deploy --target prod --env-file .env.production
  npm run db -- migrate-dev --target dev --env-file .env.local --name add_indexes
  npm run db -- reset --target dev --url 'postgresql://.../mydb' --confirm mydb

The script never loads .env or .env.local implicitly. Prefer --env-file so a URL
does not remain in shell history. It only reads DATABASE_URL from that file.

Vercel helpers:
  make vercel-link                 Link this checkout to a Vercel project
  make vercel-env-list-prod        List Production variable names and metadata
  make vercel-env-pull-prod        Pull Production values into .env.production
  make vercel-env-pull-prod-force  Pull and overwrite without confirmation
`

const valueOptions = new Set([
  "--url",
  "--env-file",
  "--target",
  "--name",
  "--confirm",
])
const booleanOptions = new Set([
  "--allow-production-reset",
  "--accept-data-loss",
  "--allow-production-push",
  "--help",
  "-h",
])

export function parseArguments(argv) {
  const result = { command: undefined }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (!argument.startsWith("-")) {
      if (result.command) {
        throw new Error(`Unexpected argument: ${argument}`)
      }
      result.command = argument
      continue
    }

    if (valueOptions.has(argument)) {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value`)
      }
      result[argument.slice(2).replaceAll("-", "_")] = value
      index += 1
      continue
    }

    if (booleanOptions.has(argument)) {
      const key = argument.replace(/^-+/, "").replaceAll("-", "_")
      result[key] = true
      continue
    }

    throw new Error(`Unknown option: ${argument}`)
  }

  return result
}

function enabled(value) {
  return ["1", "true", "yes"].includes(value?.toLowerCase())
}

export function applyEnvironmentOptions(options, environment = process.env) {
  return {
    ...options,
    target: options.target || environment.TARGET,
    url: options.url || environment.DB_URL,
    env_file: options.env_file || environment.DB_ENV_FILE,
    name: options.name || environment.NAME,
    confirm: options.confirm || environment.CONFIRM,
    allow_production_reset:
      options.allow_production_reset ||
      enabled(environment.ALLOW_PRODUCTION_RESET),
    accept_data_loss:
      options.accept_data_loss || enabled(environment.ACCEPT_DATA_LOSS),
    allow_production_push:
      options.allow_production_push ||
      enabled(environment.ALLOW_PRODUCTION_PUSH),
  }
}

export function resolveDatabaseUrl(options, environment = process.env) {
  if (options.url && options.env_file) {
    throw new Error("Use either --url or --env-file, not both")
  }

  if (options.url) return options.url

  if (options.env_file) {
    const path = resolve(process.cwd(), options.env_file)
    let parsed
    try {
      parsed = dotenv.parse(readFileSync(path))
    } catch (error) {
      throw new Error(
        `Could not read env file ${options.env_file}: ${error.message}`
      )
    }

    if (!parsed.DATABASE_URL) {
      throw new Error(`${options.env_file} does not contain DATABASE_URL`)
    }
    return parsed.DATABASE_URL
  }

  if (environment.DATABASE_URL) return environment.DATABASE_URL

  throw new Error(
    "No database source supplied. Use --url, --env-file, or DATABASE_URL."
  )
}

export function describeDatabase(databaseUrl) {
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error("DATABASE_URL is not a valid URL")
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(
      "DATABASE_URL must use the postgresql:// or postgres:// scheme"
    )
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  if (!parsed.hostname || !database) {
    throw new Error("DATABASE_URL must include a host and database name")
  }

  const host = parsed.port
    ? `${parsed.hostname}:${parsed.port}`
    : parsed.hostname
  return { database, display: `${host}/${database}` }
}

export function validateOptions(options, database) {
  const commands = new Set([
    "status",
    "deploy",
    "migrate-dev",
    "reset",
    "push",
    "pull",
    "studio",
    "generate",
    "validate",
    "format",
  ])

  if (!options.command || !commands.has(options.command)) {
    throw new Error(
      options.command
        ? `Unknown command: ${options.command}`
        : "A database command is required"
    )
  }

  if (options.target !== "dev" && options.target !== "prod") {
    throw new Error("--target must be either dev or prod")
  }

  if (options.command === "migrate-dev" && options.target === "prod") {
    throw new Error("migrate-dev is disabled for prod; use deploy instead")
  }

  if (options.command === "reset") {
    if (options.confirm !== database) {
      throw new Error(
        `Reset requires --confirm ${database} (the database name from DATABASE_URL)`
      )
    }
    if (options.target === "prod" && !options.allow_production_reset) {
      throw new Error(
        "Production reset requires --allow-production-reset in addition to --confirm"
      )
    }
  }

  if (
    options.command === "push" &&
    options.target === "prod" &&
    !options.allow_production_push
  ) {
    throw new Error("Production push requires --allow-production-push")
  }
}

export function buildPrismaArguments(options) {
  switch (options.command) {
    case "status":
      return ["migrate", "status"]
    case "deploy":
      return ["migrate", "deploy"]
    case "migrate-dev":
      return [
        "migrate",
        "dev",
        ...(options.name ? ["--name", options.name] : []),
      ]
    case "reset":
      return ["migrate", "reset", "--force"]
    case "push":
      return [
        "db",
        "push",
        ...(options.accept_data_loss ? ["--accept-data-loss"] : []),
      ]
    case "pull":
      return ["db", "pull"]
    case "studio":
      return ["studio"]
    case "generate":
      return ["generate"]
    case "validate":
      return ["validate"]
    case "format":
      return ["format"]
    default:
      throw new Error(`Unknown command: ${options.command}`)
  }
}

export function run(argv = process.argv.slice(2)) {
  const options = applyEnvironmentOptions(parseArguments(argv))
  if (options.help || !options.command) {
    process.stdout.write(help)
    return options.help ? 0 : 1
  }

  const databaseUrl = resolveDatabaseUrl(options)
  const target = describeDatabase(databaseUrl)
  validateOptions(options, target.database)

  const prismaExecutable = resolve(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma"
  )
  const prismaArguments = buildPrismaArguments(options)

  console.log(`Database target: ${options.target} (${target.display})`)
  console.log(`Operation: prisma ${prismaArguments.join(" ")}`)

  const result = spawnSync(prismaExecutable, prismaArguments, {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  })

  if (result.error) throw result.error
  return result.status ?? 1
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    process.exitCode = run()
  } catch (error) {
    console.error(`Database command failed: ${error.message}`)
    process.exitCode = 1
  }
}
