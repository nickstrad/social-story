import { createTRPCRouter, protectedProcedure, publicProcedure } from "./trpc"

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => "ok"),
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),
})

export type AppRouter = typeof appRouter
