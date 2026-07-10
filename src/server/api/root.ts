import { createTRPCRouter, protectedProcedure, publicProcedure } from "./trpc"
import { characterRouter } from "./routers/character"
import { ruleRouter } from "./routers/rule"
import { taskRouter } from "./routers/task"

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => "ok"),
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),
  character: characterRouter,
  rule: ruleRouter,
  task: taskRouter,
})

export type AppRouter = typeof appRouter
