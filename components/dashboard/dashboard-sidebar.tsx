"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Home,
  BookOpen,
  Award,
  Users,
  Settings,
  Target,
  Calendar,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { ResponsiveSidebar } from "@/components/ui/responsive-sidebar"

export function DashboardSidebar() {
  const pathname = usePathname()
  const [userType, setUserType] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [courseCount, setCourseCount] = useState<number>(0)
  const [certificateCount, setCertificateCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      if (!user?.email) {
        setIsLoading(false)
        return
      }

      const { data: userData } = await supabaseBrowser
        .from("users")
        .select("user_type, organization_id")
        .eq("email", user.email)
        .single()
      setUserType(userData?.user_type || null)
      setOrganizationId(userData?.organization_id || null)

      const { count: enrollCount } = await supabaseBrowser
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
      setCourseCount(enrollCount ?? 0)

      const { count: certCount } = await supabaseBrowser
        .from("certificates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active")
      setCertificateCount(certCount ?? 0)

      setIsLoading(false)
    }
    fetchUserData()
  }, [])

  const menuItems = [
    {
      title: "Overview",
      href: "/dashboard",
      icon: Home,
      disabled: false,
    },
    {
      title: "My Courses",
      href: "/dashboard/courses",
      icon: BookOpen,
      badge: courseCount.toString(),
      disabled: false,
    },
    {
      title: "My Certificates",
      href: "/dashboard/certificates",
      icon: Award,
      badge: certificateCount.toString(),
      disabled: false,
    },
    {
      title: "Learning Paths",
      href: "/dashboard/learningpaths",
      icon: Target,
      disabled: false,
    },
    {
      title: "Team Progress",
      href: "/dashboard/team",
      icon: Users,
      userTypes: ["lgu", "suc", "hei", "government"],
      // Only when linked to an organization — otherwise the page has nothing to show.
      disabled: !organizationId,
    },
    {
      title: "Events",
      href: "/events",
      icon: Calendar,
      disabled: false,
    },
  ]

  const supportItems = [
    {
      title: "Settings",
      href: "/dashboard/profile",
      icon: Settings,
      disabled: false,
    },
  ]

  const isAuthorized = (types: string[] | undefined) =>
    !types || (userType && types.includes(userType))

  const nav = (
    <>
      <nav className="space-y-2">
        {isLoading ? (
          <p className="px-3 text-sm text-muted-foreground">Loading…</p>
        ) : (
          menuItems.map((item) => {
            if (!isAuthorized(item.userTypes)) return null
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
                asChild={!item.disabled}
                disabled={item.disabled}
              >
                {item.disabled ? (
                  <span className="flex w-full items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.title}
                  </span>
                ) : (
                  <Link href={item.href} className="flex w-full items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.title}
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                )}
              </Button>
            )
          })
        )}
      </nav>

      <div className="mt-8">
        <h4 className="mb-2 px-3 text-sm font-medium text-muted-foreground">Account</h4>
        <nav className="space-y-2">
          {supportItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
                asChild
              >
                <Link href={item.href} className="flex w-full items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.title}
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </>
  )

  return <ResponsiveSidebar title="Dashboard">{nav}</ResponsiveSidebar>
}
