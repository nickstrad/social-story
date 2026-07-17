"use client"

import { AppHeader } from "@/components/layout/AppHeader"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useSignOut } from "@/hooks/useSignOut"

export function AppShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  const signOut = useSignOut()
  return (
    // The provider's default min-h-svh/row layout is replaced here: the header
    // owns the top strip and the sidebar+content row fills what's left. Both
    // the header and the sidebar — which the shared component positions as
    // `fixed inset-y-0` — size themselves from the app-header theme token.
    <SidebarProvider className="min-h-0 flex-1 flex-col">
      <AppHeader
        email={email}
        onSignOut={signOut.handleSignOut}
        isSigningOut={signOut.isSigningOut}
      />
      <div className="flex flex-1">
        <AppSidebar />
        {/* SidebarInset is itself the <main> landmark, so this is just the
            centered content column inside it. */}
        <SidebarInset>
          <div className="mx-auto w-full max-w-app flex-1 px-app-gutter py-page-block">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
