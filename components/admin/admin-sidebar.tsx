"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Home, Users, BookOpen, BarChart3, ClipboardCheck, FolderInput, Calendar, Target } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

export function AdminSidebar() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [courseCount, setCourseCount] = useState<number | null>(null)
  const [eventCount, setEventCount] = useState<number | null>(null)
  const [pathCount, setPathCount] = useState<number | null>(null)

  // Real counts for nav badges. head+count avoids fetching rows.
  useEffect(() => {
    const load = async () => {
      const [pending, users, courses, events, paths] = await Promise.all([
        supabaseBrowser.from("modules").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
        supabaseBrowser.from("users").select("id", { count: "exact", head: true }),
        supabaseBrowser.from("courses").select("id", { count: "exact", head: true }),
        supabaseBrowser.from("events").select("id", { count: "exact", head: true })
          .eq("is_published", true).gte("starts_at", new Date().toISOString()),
        supabaseBrowser.from("learningpaths").select("id", { count: "exact", head: true }).eq("status", "active"),
      ])
      setPendingCount(pending.count ?? 0)
      setUserCount(users.count ?? null)
      setCourseCount(courses.count ?? null)
      setEventCount(events.count ?? null)
      setPathCount(paths.count ?? null)
    }
    load()
  }, [])

  // Only nav items whose route actually exists. Dead links (Certificates,
  // Organizations, Regional Data, Content, Messages, System Settings,
  // Security) were removed rather than left pointing at non-existent pages.
  // Events was restored in 016, now backed by a real table and page.
  const menuItems = [
    { title: "Dashboard", href: "/admin", icon: Home },
    { title: "User Management", href: "/admin/users", icon: Users, badge: userCount != null ? userCount.toLocaleString() : undefined },
    { title: "Course Management", href: "/admin/courses", icon: BookOpen, badge: courseCount != null ? courseCount.toLocaleString() : undefined },
    { title: "Content Review", href: "/admin/review", icon: ClipboardCheck, badge: pendingCount != null && pendingCount > 0 ? String(pendingCount) : undefined },
    { title: "Assign Modules", href: "/admin/assign", icon: FolderInput },
    { title: "Events", href: "/admin/events", icon: Calendar, badge: eventCount ? String(eventCount) : undefined },
    { title: "Learning Paths", href: "/admin/learning-paths", icon: Target, badge: pathCount ? String(pathCount) : undefined },
    { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  ]

  return (
    <aside className="w-64 border-r bg-card/30 min-h-screen">
      <div className="p-6">
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
                asChild
              >
                <Link href={item.href} prefetch={false}>
                  <item.icon className="w-4 h-4" />
                  {item.title}
                  {item.badge && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
