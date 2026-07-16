import { Inngest } from "inngest"

import { getConfig } from "@/server/config"

const config = getConfig().inngest

export const inngest = new Inngest({
  id: "social-story",
  isDev: config.isDev,
  eventKey: config.eventKey,
  signingKey: config.signingKey,
  signingKeyFallback: config.signingKeyFallback,
})
