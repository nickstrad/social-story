import type { PrismaClient } from "@prisma/client"

import type { Config } from "./config"
import { getConfig } from "./config"
import { db } from "./db"
import type { Repos } from "./ports/repos"
import type { Storage } from "./ports/storage"
import { prismaRepos } from "./repos/prisma"
import { createVercelBlobStorage } from "./services/vercel-blob-storage"

export interface Deps {
  storage: Storage
  repos: Repos
}

let deps: Deps | undefined

export function createDeps(config: Config, client: PrismaClient = db): Deps {
  return {
    storage: createVercelBlobStorage(config.blob.token),
    repos: prismaRepos(client),
  }
}

export function getDeps(): Deps {
  deps ??= createDeps(getConfig())
  return deps
}
