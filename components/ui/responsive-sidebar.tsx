"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

/**
 * Desktop: fixed-width aside. Mobile: compact menu trigger + left sheet.
 * Designed to drop into existing `flex` page shells without layout rewrites.
 */
export function ResponsiveSidebar({
  title = "Menu",
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      <div className="shrink-0 border-r bg-background md:hidden">
        <div className="sticky top-16 z-40 p-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" aria-label={`Open ${title}`}>
                <Menu className="h-4 w-4" />
                {title}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto p-0">
              <SheetHeader className="border-b px-6 py-4 text-left">
                <SheetTitle>{title}</SheetTitle>
              </SheetHeader>
              <div className="p-4">{children}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <aside className="sticky top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 shrink-0 self-start overflow-y-auto border-r bg-card/30 md:block">
        <div className="p-6">{children}</div>
      </aside>
    </>
  )
}
