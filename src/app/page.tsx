import { headers } from "next/headers"
import Link from "next/link"

import { LandingHeader } from "@/components/layout/LandingHeader"
import { buttonVariants } from "@/components/ui/button"
import { getServerSession } from "@/server/auth-session"

export default async function Home() {
  const session = await getServerSession(await headers())
  const isAuthenticated = Boolean(session)

  return (
    <div className="flex flex-1 flex-col bg-background">
      <LandingHeader isAuthenticated={isAuthenticated} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Personalized social stories, made in minutes
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            Build clear, visual social stories tailored to the people and
            moments that matter — then export and share them anywhere.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Link href="/stories" className={buttonVariants({ size: "lg" })}>
              Go to your stories
            </Link>
          ) : (
            <>
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Get started
              </Link>
              <Link
                href="/signin"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
