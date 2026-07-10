import { createTRPCRouter, protectedProcedure, publicProcedure } from "./trpc"
import { characterRouter } from "./routers/character"
import { pageRouter } from "./routers/page"
import { ruleRouter } from "./routers/rule"
import { storyRouter } from "./routers/story"
import { taskRouter } from "./routers/task"

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => "ok"),
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),
  character: characterRouter,
  page: pageRouter,
  rule: ruleRouter,
  story: storyRouter,
  task: taskRouter,
})

export type AppRouter = typeof appRouter
