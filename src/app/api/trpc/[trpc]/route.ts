import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

import { appRouter } from "@/server/api/root"
import { createTRPCContext } from "@/server/api/trpc"

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: request.headers }),
  })
}

export { handler as GET, handler as POST }
