"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertCircle } from "lucide-react"

// Client-side PDF rendering via react-pdf (which wraps pdfjs-dist). The signed
// URL is fetched directly by the viewer's browser from Supabase Storage and is
// never handed to any third-party domain (it previously went to
// docs.google.com/viewer, defeating the private-bucket + signed-URL design).
//
// The worker is served same-origin from /public and MUST match react-pdf's
// bundled pdfjs-dist version (see public/pdf.worker.min.mjs, copied from
// react-pdf/node_modules/pdfjs-dist) — a mismatch throws an API/Worker error.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

export function PdfViewer({
  url,
  initialPage = 1,
  onPageChange,
  onDocumentLoad,
}: {
  url: string
  initialPage?: number
  /** Fires whenever the visible page changes — lets a parent read the page the
   *  user is actually looking at (used by the instructor module editor). */
  onPageChange?: (page: number) => void
  /** Fires once the PDF is parsed, with its real page count. */
  onDocumentLoad?: (numPages: number) => void
}) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [scale, setScale] = useState(1.2)
  const [failed, setFailed] = useState(false)

  const onLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      setPage(Math.min(Math.max(1, initialPage || 1), n))
      onDocumentLoad?.(n)
    },
    [initialPage, onDocumentLoad]
  )

  useEffect(() => {
    onPageChange?.(page)
  }, [page, onPageChange])

  const go = useCallback(
    (delta: number) => setPage((p) => Math.min(Math.max(1, p + delta), numPages || 1)),
    [numPages]
  )

  // Stable file prop so react-pdf doesn't re-fetch the PDF on every render.
  const file = useMemo(() => url, [url])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={failed || page <= 1} aria-label="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[6rem] text-center">
            {numPages ? `Page ${page} of ${numPages}` : "…"}
          </span>
          <Button variant="outline" size="sm" onClick={() => go(1)} disabled={failed || page >= numPages} aria-label="Next page">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} disabled={failed} aria-label="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(3, s + 0.2))} disabled={failed} aria-label="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="relative w-full h-[600px] overflow-auto border rounded-md bg-muted/30 flex justify-center">
        <Document
          file={file}
          onLoadSuccess={onLoadSuccess}
          onLoadError={() => setFailed(true)}
          loading={
            <div className="flex items-center justify-center h-[600px]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-[600px] gap-2 text-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <p className="text-red-600">Failed to load PDF.</p>
            </div>
          }
        >
          <Page pageNumber={page} scale={scale} renderAnnotationLayer renderTextLayer />
        </Document>
      </div>
    </div>
  )
}
