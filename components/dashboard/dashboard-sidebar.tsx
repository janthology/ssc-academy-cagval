"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Home,
  BookOpen,
  Award,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  Building2,
  Target,
  Calendar,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

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

      const { data: enrollmentData } = await supabaseBrowser
        .from("enrollments")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
      setCourseCount(enrollmentData?.length || 0)

      const { data: certificateData } = await supabaseBrowser
        .from("certificates")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "active")
      setCertificateCount(certificateData?.length || 0)

      setIsLoading(false)
    }
    fetchUserData()
  }, [])

  if (isLoading) {
    return <aside className="w-64 min-h-screen border-r bg-card/30" /> // Placeholder during loading
  }

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
      // Enabled only once the user is actually linked to an organization —
      // truer than the user_type list alone, and the page then has real data.
      disabled: !organizationId,
    },
    {
      title: "Analytics",
      href: "/dashboard/analytics",
      icon: BarChart3,
      userTypes: ["lgu", "dost", "government"],
      disabled: true,
    },
    {
      title: "Organization",
      href: "/dashboard/organization",
      icon: Building2,
      userTypes: ["lgu", "suc", "hei", "government"],
      disabled: true,
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
      title: "Help Center",
      href: "/help",
      icon: HelpCircle,
      disabled: true,
    },
    {
      title: "Settings",
      href: "/dashboard/profile",
      icon: Settings,
      disabled: false,
    },
  ]

  const isAuthorized = (types: string[] | undefined) =>
    !types || (userType && types.includes(userType))

  return (
    <aside className="w-64 border-r bg-card/30 min-h-screen">
      <div className="p-6">
        <nav className="space-y-2">
          {menuItems.map((item) => {
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
                  <span>
                    <item.icon className="w-4 h-4 inline-block mr-3" />
                    {item.title}
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </span>
                ) : (
                  <Link href={item.href}>
                    <item.icon className="w-4 h-4" />
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
          })}
        </nav>

        <div className="mt-8">
          <h4 className="text-sm font-medium text-muted-foreground mb-2 px-3">Support</h4>
          <nav className="space-y-2">
            {supportItems.map((item) => {
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
                    <span>
                      <item.icon className="w-4 h-4 inline-block mr-3" />
                      {item.title}
                    </span>
                  ) : (
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      {item.title}
                    </Link>
                  )}
                </Button>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}