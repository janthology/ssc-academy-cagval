"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Home, Users, BookOpen, BarChart3, ClipboardCheck, FolderInput, Calendar, Target } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { formatNumber } from "@/lib/utils/dates"
import { ResponsiveSidebar } from "@/components/ui/responsive-sidebar"
import { useAdminStats } from "@/components/admin/admin-stats-provider"

export function AdminSidebar() {
  const pathname = usePathname()
  const {
    loading,
    pendingModules,
    userCount,
    courseCount,
    eventCount,
    pathCount,
  } = useAdminStats()

  const menuItems = [
    { title: "Dashboard", href: "/admin", icon: Home },
    {
      title: "User Management",
      href: "/admin/users",
      icon: Users,
      badge: !loading ? formatNumber(userCount) : undefined,
    },
    {
      title: "Course Management",
      href: "/admin/courses",
      icon: BookOpen,
      badge: !loading ? formatNumber(courseCount) : undefined,
    },
    {
      title: "Content Review",
      href: "/admin/review",
      icon: ClipboardCheck,
      badge: !loading && pendingModules > 0 ? String(pendingModules) : undefined,
    },
    { title: "Assign Modules", href: "/admin/assign", icon: FolderInput },
    {
      title: "Events",
      href: "/admin/events",
      icon: Calendar,
      badge: !loading && eventCount > 0 ? String(eventCount) : undefined,
    },
    {
      title: "Learning Paths",
      href: "/admin/learning-paths",
      icon: Target,
      badge: !loading && pathCount > 0 ? String(pathCount) : undefined,
    },
    { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  ]

  const nav = (
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
            <Link href={item.href} prefetch={false} className="flex w-full items-center gap-3">
              <item.icon className="h-4 w-4 shrink-0" />
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
  )

  return <ResponsiveSidebar title="Admin">{nav}</ResponsiveSidebar>
}
