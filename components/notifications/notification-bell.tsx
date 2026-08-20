"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Bell, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUser, type Notification } from "@/components/providers/user-provider"

function timeAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/**
 * Real notification bell — unread-count badge + a dropdown of recent items, each
 * linking to the relevant page (mark-read-then-navigate) plus a mark-all-read
 * action. Data + actions come from the shared user context (no own fetch loop).
 */
export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useUser()
  const router = useRouter()
  // Defer Date.now()-based timestamps to client-only to avoid hydration mismatch.
  // The server has no user notifications on first render anyway (context default
  // is []), but once the client loads them the relative times must not differ
  // from a stale server-rendered value.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const openNotification = (n: Notification) => {
    if (!n.read) markRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.preventDefault(); markAllRead() }}
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-pointer items-start gap-2"
                onSelect={() => openNotification(n)}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground" suppressHydrationWarning>
                    {mounted ? timeAgo(n.created_at) : ""}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
