import { Skeleton } from "@/components/ui/skeleton"

/** Course catalog shell — matches CatalogClient layout without a spinner. */
export function CoursesPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48 sm:w-72" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>

        <Skeleton className="mb-8 h-12 w-full" />

        <div className="grid gap-8 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-1">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <div className="space-y-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
            <CourseCardsSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

export function CourseCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border bg-card">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mt-2 h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Dashboard / admin shell with sidebar + main content placeholders. */
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      <div className="flex">
        <aside className="hidden w-64 shrink-0 border-r p-6 md:block">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <div className="mt-8 space-y-2">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        </aside>

        <main className="flex-1 space-y-6 p-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 rounded-lg border p-6 lg:col-span-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
            <div className="space-y-4 rounded-lg border p-6">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Public marketing-style page (events / learning paths). */
export function PublicContentSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48 sm:w-72" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      <div className="container mx-auto space-y-8 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <Skeleton className="mx-auto h-5 w-36" />
          <Skeleton className="mx-auto h-10 w-64" />
          <Skeleton className="mx-auto h-5 w-full max-w-xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-lg border p-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Generic soft placeholder for catch-all routes. */
export function SoftPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto space-y-6 px-4 py-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
