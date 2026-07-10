import type { PrismaClient } from "@prisma/client"

import type { Repos } from "../../ports/repos"
import { prismaCharacterRepo } from "./character-repo"
import { prismaPageRepo } from "./page-repo"
import { prismaRuleRepo } from "./rule-repo"
import { prismaStoryRepo } from "./story-repo"
import { prismaTaskRepo } from "./task-repo"

export const prismaRepos = (db: PrismaClient): Repos => ({
  stories: prismaStoryRepo(db),
  characters: prismaCharacterRepo(db),
  rules: prismaRuleRepo(db),
  pages: prismaPageRepo(db),
  tasks: prismaTaskRepo(db),
})
