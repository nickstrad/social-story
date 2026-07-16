import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/AppShell"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"
import { getServerSession } from "@/server/auth-session"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(await headers())
  if (!session) redirect("/signin")

  // The sidebar reads story.list on every app page. Without this the client
  // link would try to fetch it during SSR against a relative URL, which has no
  // base on the server — it recovers on the client, but only after logging a
  // TRPCClientError per render. Hydrating the cache means no server fetch.
  prefetch(trpc.story.list.prefetch())

  return (
    <HydrateClient>
      <AppShell email={session.user.email}>{children}</AppShell>
    </HydrateClient>
  )
}
