import Link from "next/link"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"

type AppHeaderProps = {
  email: string
  isSigningOut: boolean
  onSignOut: () => void
}

export function AppHeader({ email, isSigningOut, onSignOut }: AppHeaderProps) {
  return (
    // Sticky so the offcanvas sidebar, which is fixed just below it, never
    // slides up over the brand and sign-out controls.
    <header className="sticky top-0 z-20 h-app-header shrink-0 border-b bg-background">
      <div className="flex h-full items-center justify-between gap-4 px-app-gutter">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Link href="/stories" className="font-semibold">
            Social Story
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {email}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isSigningOut}
            onClick={onSignOut}
          >
            {isSigningOut && <Spinner />}
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
