import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { ZodError } from "zod"

import { getServerSession } from "@/server/auth-session"
import type { Deps } from "@/server/container"
import { getDeps } from "@/server/container"

export interface Context {
  deps: Deps
  session: Awaited<ReturnType<typeof getServerSession>>
}

export async function createTRPCContext({
  headers,
}: {
  headers: Headers
}): Promise<Context> {
  return {
    deps: getDeps(),
    session: await getServerSession(headers),
  }
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  })
})
