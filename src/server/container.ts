import type { PrismaClient } from "@/generated/prisma"

import type { Config } from "./config"
import { getConfig } from "./config"
import { db } from "./db"
import type { Repos } from "./ports/repos"
import type { Storage } from "./ports/storage"
import type { ImageGenerator } from "./ports/image"
import type { TextGenerator } from "./ports/text"
import type { TaskDispatcher } from "./ports/dispatcher"
import { inngestDispatcher } from "./inngest/dispatcher"
import { getTaskHandler } from "./inngest/handlers"
import { prismaRepos } from "./repos/prisma"
import { createVercelBlobStorage } from "./services/vercel-blob-storage"
import { e2eStorage } from "./services/e2e-storage"
import { imageFixture, parseFixture } from "./services/e2e-fixtures"
import {
  immediateDispatcher,
  scriptedImageGenerator,
  staticTextGenerator,
} from "./services/fakes"
import { openAIImageGenerator } from "./services/openai/image"
import { openAITextGenerator } from "./services/openai/text"
import { runTask } from "./services/tasks"
// Side-effect import: registers every concrete task handler (PARSE_STORY,
// BASE_IMAGE, …) so the inline E2E dispatcher can resolve them by type.
import "./inngest/functions"

export interface Deps {
  storage: Storage
  repos: Repos
  text: TextGenerator
  image: ImageGenerator
  dispatcher: TaskDispatcher
}

let deps: Deps | undefined

export function createDeps(config: Config, client: PrismaClient = db): Deps {
  const repos = prismaRepos(client)
  if (config.e2eFakes) return createE2eDeps(repos)
  return {
    storage: createVercelBlobStorage(config.blob),
    repos,
    text: openAITextGenerator(config.openai),
    image: openAIImageGenerator(config.openai),
    dispatcher: inngestDispatcher(repos),
  }
}

// Playwright E2E wiring: real Postgres repos, everything external faked. The
// dispatcher runs each task inline through the same handler registry Inngest
// uses, so `story.parse` / base-image tasks reach a terminal state before the
// mutation resolves and the polling UI observes DONE on its first poll.
function createE2eDeps(repos: Repos): Deps {
  const e2eDeps: Deps = {
    repos,
    storage: e2eStorage(),
    text: staticTextGenerator(parseFixture()),
    image: scriptedImageGenerator(imageFixture),
    dispatcher: immediateDispatcher(async (taskId) => {
      const task = await repos.tasks.getById(taskId)
      const handler = task && getTaskHandler(task.type)
      if (handler) await runTask(e2eDeps, taskId, handler)
    }),
  }
  return e2eDeps
}

export function getDeps(): Deps {
  deps ??= createDeps(getConfig())
  return deps
}
