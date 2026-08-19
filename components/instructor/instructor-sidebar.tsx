"use client"

import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function InstructorSidebar() {
  const pathname = usePathname()

  // One item, one real page. Nav entries are added here only when the page
  // behind them exists.
  const menuItems = [
    {
      title: "My Courses",
      href: "/instructor",
      icon: BookOpen,
    },
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
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
