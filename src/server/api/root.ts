import { createTRPCRouter, protectedProcedure, publicProcedure } from "./trpc"
import { artifactRouter } from "./routers/artifact"
import { characterRouter } from "./routers/character"
import { pageRouter } from "./routers/page"
import { libraryRouter } from "./routers/library"
import { pdfRouter } from "./routers/pdf"
import { ruleRouter } from "./routers/rule"
import { storyRouter } from "./routers/story"
import { taskRouter } from "./routers/task"

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => "ok"),
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),
  artifact: artifactRouter,
  character: characterRouter,
  library: libraryRouter,
  page: pageRouter,
  pdf: pdfRouter,
  rule: ruleRouter,
  story: storyRouter,
  task: taskRouter,
})

export type AppRouter = typeof appRouter
