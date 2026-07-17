import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

type LandingHeaderProps = {
  isAuthenticated: boolean
}

export function LandingHeader({ isAuthenticated }: LandingHeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-app-header max-w-app items-center justify-between px-app-gutter">
        <Link href="/" className="font-semibold">
          Social Story
        </Link>
        <nav className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link href="/stories" className={buttonVariants({ size: "lg" })}>
              Go to app
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
