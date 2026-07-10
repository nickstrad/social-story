import type { PrismaClient } from "@prisma/client"

import type { Config } from "./config"
import { getConfig } from "./config"
import { db } from "./db"
import type { Repos } from "./ports/repos"
import type { Storage } from "./ports/storage"
import type { ImageGenerator } from "./ports/image"
import type { TextGenerator } from "./ports/text"
import { prismaRepos } from "./repos/prisma"
import { createVercelBlobStorage } from "./services/vercel-blob-storage"
import { openAIImageGenerator } from "./services/openai/image"
import { openAITextGenerator } from "./services/openai/text"

export interface Deps {
  storage: Storage
  repos: Repos
  text: TextGenerator
  image: ImageGenerator
}

let deps: Deps | undefined

export function createDeps(config: Config, client: PrismaClient = db): Deps {
  return {
    storage: createVercelBlobStorage(config.blob.token),
    repos: prismaRepos(client),
    text: openAITextGenerator(config.openai),
    image: openAIImageGenerator(config.openai),
  }
}

export function getDeps(): Deps {
  deps ??= createDeps(getConfig())
  return deps
}
