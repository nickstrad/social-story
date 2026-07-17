import type { PrismaClient } from "@/generated/prisma"

import type { Repos } from "../../ports/repos"
import { prismaAssetRepo } from "./asset-repo"
import { prismaCharacterRepo } from "./character-repo"
import { prismaPageRepo } from "./page-repo"
import { prismaRuleRepo } from "./rule-repo"
import { prismaStoryRepo } from "./story-repo"
import { prismaTaskRepo } from "./task-repo"

export const prismaRepos = (db: PrismaClient): Repos => {
  const build = (client: Parameters<typeof prismaAssetRepo>[0]): Repos => {
    const repos: Repos = {
      stories: prismaStoryRepo(client),
      characters: prismaCharacterRepo(client),
      rules: prismaRuleRepo(client),
      pages: prismaPageRepo(client),
      tasks: prismaTaskRepo(client),
      assets: prismaAssetRepo(client),
      transaction: (work) => work(repos),
    }
    return repos
  }
  const repos = build(db)
  repos.transaction = (work) => db.$transaction((tx) => work(build(tx)))
  return repos
}
