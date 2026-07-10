/**
 * Local development: run `npx inngest-cli dev` alongside `npm run dev`.
 */
import { serve } from "inngest/next"

import { inngest } from "@/server/inngest/client"
import { allFunctions } from "@/server/inngest/functions"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
})
