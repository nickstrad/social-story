import Link from "next/link"
import { LogOutIcon, SettingsIcon, UserRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type AppHeaderProps = {
  email: string
  isSigningOut: boolean
  onSignOut: () => void
}

function AccountMenu({ email, isSigningOut, onSignOut }: AppHeaderProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger
          render={
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isSigningOut}
                  aria-label="Open account menu"
                />
              }
            />
          }
        >
          {isSigningOut ? <Spinner /> : <UserRoundIcon />}
        </DropdownMenuTrigger>
        <TooltipContent>Open account menu</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid gap-0.5 py-1.5">
            <span>Signed in as</span>
            <span className="truncate text-sm font-normal text-popover-foreground">
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isSigningOut} onClick={onSignOut}>
          {isSigningOut ? <Spinner /> : <LogOutIcon />}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
        <AccountMenu
          email={email}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  )
}
