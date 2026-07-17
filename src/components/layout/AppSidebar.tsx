"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpenIcon, ImagesIcon, PlusIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar"
import { trpc } from "@/lib/trpc"
import { storyTitle } from "@/server/domain/storyTitle"

const NAV = [
  { href: "/stories/new", icon: PlusIcon, label: "New story" },
  { href: "/stories", icon: BookOpenIcon, label: "All stories" },
  { href: "/artifacts", icon: ImagesIcon, label: "Artifacts" },
]

/** Stories shown inline; the rest live behind "All stories". */
const RECENT_LIMIT = 8

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  // Deliberately not a suspense query: the sidebar renders on every app page,
  // and it must never hold up the page's own content while stories load. The
  // protected layout prefetches this, so it is warm from the server.
  const stories = trpc.story.list.useQuery()

  // On mobile the sidebar is a sheet overlaying the page, so it has to close
  // itself on navigate — otherwise it covers the page the user just chose.
  // Inert on desktop, where nothing reads `openMobile`.
  const closeOnMobile = () => setOpenMobile(false)

  const recent = stories.data?.slice(0, RECENT_LIMIT) ?? []

  return (
    <Sidebar
      collapsible="offcanvas"
      // Sit below the app header rather than over it: the shared component
      // pins itself to `inset-y-0 h-svh`, which assumes it owns the viewport.
      className="top-app-header h-app-body"
    >
      {/* A real landmark — the app's primary navigation, named to distinguish
          it from the per-story steps nav. */}
      <SidebarContent render={<nav aria-label="Main" />}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    render={<Link href={href} />}
                    isActive={pathname === href}
                    onClick={closeOnMobile}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Recent stories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {stories.isPending ? (
                <SidebarMenuItem>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ) : recent.length === 0 ? (
                // Deliberately not "No stories yet" — that exact phrase is the
                // /stories empty state, and duplicating it here makes every
                // getByText for it ambiguous.
                <p className="px-2 py-1 text-xs text-sidebar-foreground/70">
                  No recent stories
                </p>
              ) : (
                recent.map((story) => {
                  const title = storyTitle(story)
                  return (
                    <SidebarMenuItem key={story.id}>
                      <SidebarMenuButton
                        render={<Link href={`/stories/${story.id}/script`} />}
                        isActive={pathname.startsWith(`/stories/${story.id}/`)}
                        title={title}
                        onClick={closeOnMobile}
                      >
                        <span className="truncate">{title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
