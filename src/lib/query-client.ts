import { QueryClient } from "@tanstack/react-query"
import superjson from "superjson"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          query.state.status === "pending" || query.state.status === "success",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  })
}
