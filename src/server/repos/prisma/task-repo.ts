import { Prisma } from "@/generated/prisma"

import type { CreateTask, Task, UpdateTask } from "../../domain/types"
import type { TaskRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

const toDomain = (
  task: Awaited<ReturnType<PrismaDb["task"]["findFirstOrThrow"]>>
): Task => ({
  ...task,
  resultJson: task.resultJson as Task["resultJson"],
})

const toPrismaJson = (value: Task["resultJson"] | undefined) =>
  value === null ? Prisma.JsonNull : value

const createData = (input: CreateTask): Prisma.TaskUncheckedCreateInput => ({
  ...input,
  resultJson: toPrismaJson(input.resultJson ?? null),
})

const updateData = (input: UpdateTask): Prisma.TaskUncheckedUpdateInput => ({
  ...input,
  resultJson:
    input.resultJson === undefined ? undefined : toPrismaJson(input.resultJson),
})

async function changedTask(
  db: PrismaDb,
  id: string,
  count: number
): Promise<Task | null> {
  if (count === 0) return null
  return toDomain(await db.task.findUniqueOrThrow({ where: { id } }))
}

async function listTasksByStoryIds(
  db: PrismaDb,
  storyIds: string[]
): Promise<Task[]> {
  return (
    await db.task.findMany({
      where: { storyId: { in: storyIds } },
      orderBy: { createdAt: "desc" },
    })
  ).map(toDomain)
}

export const prismaTaskRepo = (db: PrismaDb): TaskRepo => ({
  async create(input) {
    return toDomain(await db.task.create({ data: createData(input) }))
  },
  async getById(id) {
    const task = await db.task.findUnique({ where: { id } })
    return task ? toDomain(task) : null
  },
  listByStory: (storyId) => listTasksByStoryIds(db, [storyId]),
  listByStoryIds: (storyIds) => listTasksByStoryIds(db, storyIds),
  async claimPending(id, startedAt) {
    const claimed = await db.task.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "RUNNING", startedAt },
    })
    return changedTask(db, id, claimed.count)
  },
  async completeRunning(id, input) {
    const completed = await db.task.updateMany({
      where: { id, status: "RUNNING" },
      data: {
        status: "SUCCEEDED",
        resultJson: toPrismaJson(input.resultJson),
        finishedAt: input.finishedAt,
      },
    })
    return changedTask(db, id, completed.count)
  },
  async failActive(id, error, finishedAt) {
    const failed = await db.task.updateMany({
      where: { id, status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "FAILED", error, finishedAt },
    })
    return changedTask(db, id, failed.count)
  },
  async update(id, input) {
    return toDomain(
      await db.task.update({ where: { id }, data: updateData(input) })
    )
  },
})
