import { createTRPCRouter, protectedProcedure, publicProcedure } from "./trpc"
import { taskRouter } from "./routers/task"

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => "ok"),
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),
  task: taskRouter,
})

export type AppRouter = typeof appRouter
