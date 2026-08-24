"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Award, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UUID_REGEX } from "@/lib/certificates/constants"

type LookupError = "empty" | "invalid" | "not_found" | "revoked" | "error" | null

export function CertificateVerifyLookup() {
  const router = useRouter()
  const [ref, setRef] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<LookupError>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = ref.trim()
    setError(null)

    if (!trimmed) {
      setError("empty")
      return
    }

    if (trimmed.length < 8) {
      setError("invalid")
      return
    }

    setBusy(true)
    try {
      // Prefer deep-link navigation for UUIDs (shareable /verify/{id} URL).
      if (UUID_REGEX.test(trimmed)) {
        router.push(`/verify/${trimmed}`)
        return
      }

      const res = await fetch(`/api/certificates/verify?ref=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      })
      const body = await res.json().catch(() => ({}))

      if (body?.status === "valid" && body.certificate?.id) {
        router.push(`/verify/${body.certificate.id}`)
        return
      }
      if (body?.status === "valid" && UUID_REGEX.test(trimmed)) {
        router.push(`/verify/${trimmed}`)
        return
      }
      if (body?.status === "revoked") {
        setError("revoked")
        return
      }
      if (body?.status === "not_found") {
        setError("not_found")
        return
      }
      setError("error")
    } catch {
      setError("error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-xl mx-auto w-full">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Award className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">Verify a certificate</CardTitle>
        <CardDescription>
          Anyone can check a certificate without signing in. Enter the certificate ID from a
          verification link, or the certificate number printed on the document.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="certificate-ref">Certificate ID or number</Label>
            <Input
              id="certificate-ref"
              value={ref}
              onChange={(e) => {
                setRef(e.target.value)
                if (error) setError(null)
              }}
              placeholder="e.g. 0ecd9344-757c-… or DOST02SSCP-…"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="font-mono text-sm"
            />
          </div>

          {error === "empty" && (
            <p className="text-sm text-red-600">Enter a certificate ID or number to continue.</p>
          )}
          {error === "invalid" && (
            <p className="text-sm text-red-600">That value looks too short. Paste the full ID or number.</p>
          )}
          {error === "not_found" && (
            <p className="text-sm text-muted-foreground">
              No certificate matches that ID or number. Double-check the value and try again.
            </p>
          )}
          {error === "revoked" && (
            <p className="text-sm text-red-600">
              A certificate with that reference exists but has been revoked and is not valid.
            </p>
          )}
          {error === "error" && (
            <p className="text-sm text-red-600">Verification is temporarily unavailable. Please try again.</p>
          )}

          <Button type="submit" className="w-full gap-2 cursor-pointer" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {busy ? "Checking…" : "Verify certificate"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          No account needed. Issued by SSC Academy Cagayan Valley · DOST Region 02.{" "}
          <Link href="/" className="text-primary underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
