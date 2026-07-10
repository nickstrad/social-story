import { createTRPCRouter, protectedProcedure, publicProcedure } from "./trpc"
import { characterRouter } from "./routers/character"
import { ruleRouter } from "./routers/rule"

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => "ok"),
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),
  character: characterRouter,
  rule: ruleRouter,
})

export type AppRouter = typeof appRouter
