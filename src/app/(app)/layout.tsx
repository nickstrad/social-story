import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/AppShell"
import { getServerSession } from "@/server/auth-session"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(await headers())
  if (!session) redirect("/signin")

  return <AppShell email={session.user.email}>{children}</AppShell>
}
