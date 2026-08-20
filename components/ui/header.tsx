"use client"

import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpenText, Settings, LogOut, Shield, GraduationCap } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { useUser } from "@/components/providers/user-provider"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ProfileAvatar } from "@/components/ui/profile-avatar"

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { profile: user, loading: isLoading, error: userError, retry } = useUser()

  const handleLogout = async () => {
    try {
      const { error } = await supabaseBrowser.auth.signOut()
      if (error) throw error
      router.push("/login")
    } catch {
      /* ignore */
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-sky-50/95 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
            <BookOpenText className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-foreground sm:text-xl">
              <span className="sm:hidden">SSCA</span>
              <span className="hidden sm:inline">Smart &amp; Sustainable Communities Academy</span>
            </h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">Cagayan Valley · DOST Region 02</p>
          </div>
        </Link>

        {isLoading ? (
          <Button variant="outline" size="sm" disabled>
            Loading…
          </Button>
        ) : userError ? (
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        ) : user ? (
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {!pathname?.startsWith("/dashboard") && !pathname?.startsWith("/certificates") && (
              <Button
                variant="outline"
                size="sm"
                className="hidden cursor-pointer sm:inline-flex"
                onClick={() => router.push("/dashboard")}
              >
                Dashboard
              </Button>
            )}

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full cursor-pointer">
                  <ProfileAvatar avatar={user.avatar} name={user.name} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    <Badge variant="secondary" className="mt-1 w-fit">
                      {user.user_type}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer sm:hidden">
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                {(user.is_admin || user.is_instructor) && <DropdownMenuSeparator />}
                {user.is_admin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.is_instructor && (
                  <DropdownMenuItem asChild>
                    <Link href="/instructor" className="cursor-pointer">
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Instructor Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
