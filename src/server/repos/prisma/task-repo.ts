import { Prisma, type PrismaClient } from "@prisma/client"

import type { CreateTask, Task, UpdateTask } from "../../domain/types"
import type { TaskRepo } from "../../ports/repos"

const toDomain = (
  task: Awaited<ReturnType<PrismaClient["task"]["findFirstOrThrow"]>>
): Task => ({
  ...task,
  resultJson: task.resultJson as Task["resultJson"],
})

const createData = (input: CreateTask): Prisma.TaskUncheckedCreateInput => ({
  ...input,
  resultJson: input.resultJson === null ? Prisma.JsonNull : input.resultJson,
})

const updateData = (input: UpdateTask): Prisma.TaskUncheckedUpdateInput => ({
  ...input,
  resultJson: input.resultJson === null ? Prisma.JsonNull : input.resultJson,
})

export const prismaTaskRepo = (db: PrismaClient): TaskRepo => ({
  async create(input) {
    return toDomain(await db.task.create({ data: createData(input) }))
  },
  async getById(id) {
    const task = await db.task.findUnique({ where: { id } })
    return task ? toDomain(task) : null
  },
  async listByStory(storyId) {
    return (
      await db.task.findMany({
        where: { storyId },
        orderBy: { createdAt: "desc" },
      })
    ).map(toDomain)
  },
  async update(id, input) {
    return toDomain(
      await db.task.update({ where: { id }, data: updateData(input) })
    )
  },
})
