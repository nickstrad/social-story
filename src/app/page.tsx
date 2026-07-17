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
      {/* The hero keeps its own tall py-24 rhythm and responsive headline
          scale — that composition is unique to the landing page. */}
      <main className="mx-auto flex w-full max-w-app flex-1 flex-col items-center justify-center gap-page-relaxed px-app-gutter py-24 text-center">
        <div className="flex flex-col items-center gap-section">
          <h1 className="max-w-2xl font-heading text-4xl font-title tracking-title text-balance sm:text-5xl">
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
