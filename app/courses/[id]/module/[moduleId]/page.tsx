import { Header } from "@/components/ui/header"
import { ModuleContent } from "@/components/courses/module-content"
import { supabaseServer } from "@/lib/supabase/server-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"
import Link from "next/link"

// Server component: the REAL prerequisite enforcement layer. It runs on every
// access to a module URL (including client-side navigations, which invoke the
// server component), calls the single source of truth get_unmet_prerequisites()
// with the user's own session, and refuses to render ModuleContent at all if any
// prerequisite is unmet — regardless of whether the UI elsewhere hid the entry
// point or the user already holds an enrollment row (retroactive-lock case).
export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>
}) {
  const { id, moduleId } = await params
  const supabase = await supabaseServer()

  const { data: unmet } = await supabase.rpc("get_unmet_prerequisites", { p_course_id: id })
  const unmetTitles: string[] = Array.isArray(unmet) ? unmet : []

  if (unmetTitles.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-muted-foreground" />
                Module Locked
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Complete the following prerequisite course{unmetTitles.length > 1 ? "s" : ""} before
                accessing this module:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                {unmetTitles.map((title) => (
                  <li key={title} className="font-medium">
                    {title}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline">
                <Link href={`/courses/${id}`}>Back to course</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <ModuleContent courseId={id} moduleId={moduleId} />
    </div>
  )
}
