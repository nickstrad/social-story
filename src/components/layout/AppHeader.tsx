import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type AppHeaderProps = {
  email: string
  isSigningOut: boolean
  onSignOut: () => void
}

export function AppHeader({ email, isSigningOut, onSignOut }: AppHeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <span className="font-semibold">Social Story</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{email}</span>
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
