import { auth } from "@/server/auth"

export async function getServerSession(headers: Headers) {
  const session = await auth.api.getSession({ headers })

  return session ? { user: session.user } : null
}
