"use client"

import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ResponsiveSidebar } from "@/components/ui/responsive-sidebar"

export function InstructorSidebar() {
  const pathname = usePathname()

  const menuItems = [
    {
      title: "My Courses",
      href: "/instructor",
      icon: BookOpen,
    },
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
            </Link>
          </Button>
        )
      })}
    </nav>
  )

  return <ResponsiveSidebar title="Instructor">{nav}</ResponsiveSidebar>
}
