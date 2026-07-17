import { createAuthClient } from "better-auth/react"

const authClient = createAuthClient()

export const { changePassword, signIn, signOut, signUp, useSession } =
  authClient
