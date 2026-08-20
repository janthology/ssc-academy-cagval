import { Loader2 } from "lucide-react"

/** Shared Suspense fallback used by route `loading.tsx` files. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center p-8" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  )
}
