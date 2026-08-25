"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { recordAdminAction } from "@/lib/admin/log-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Award, Loader2, Search, Ban } from "lucide-react"

type CertRow = {
  id: string
  certificate_number: string
  status: "active" | "revoked"
  issued_at: string
  user_id: string
  course_id: string
  recipientName: string
  courseTitle: string
}

export function CertificateManagement() {
  const [rows, setRows] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [working, setWorking] = useState(false)
  const [pendingRevoke, setPendingRevoke] = useState<CertRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabaseBrowser
        .from("certificates")
        .select("id, certificate_number, status, issued_at, user_id, course_id, user:users(name), course:courses(title)")
        .order("issued_at", { ascending: false })
      if (qErr) throw new Error(qErr.message)

      setRows(
        (data ?? []).map((c: any) => ({
          id: c.id,
          certificate_number: c.certificate_number,
          status: c.status,
          issued_at: c.issued_at,
          user_id: c.user_id,
          course_id: c.course_id,
          recipientName: Array.isArray(c.user) ? c.user[0]?.name : c.user?.name ?? "Unknown",
          courseTitle: Array.isArray(c.course) ? c.course[0]?.title : c.course?.title ?? "Unknown course",
        }))
      )
    } catch (err: any) {
      setError(err.message || "Failed to load certificates.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.certificate_number.toLowerCase().includes(q) ||
        r.recipientName.toLowerCase().includes(q) ||
        r.courseTitle.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    )
  }, [rows, search])

  const active = filtered.filter((r) => r.status === "active")
  const revoked = filtered.filter((r) => r.status === "revoked")

  const revoke = async (cert: CertRow) => {
    setWorking(true)
    setError(null)
    try {
      const { error: uErr } = await supabaseBrowser
        .from("certificates")
        .update({ status: "revoked" })
        .eq("id", cert.id)
        .eq("status", "active")
      if (uErr) throw new Error(uErr.message)

      recordAdminAction("certificate_revoked", cert.id, {
        message: `Certificate revoked: ${cert.certificate_number} (${cert.recipientName} — ${cert.courseTitle})`,
      })

      setRows((prev) => prev.map((r) => (r.id === cert.id ? { ...r, status: "revoked" } : r)))
      setPendingRevoke(null)
    } catch (err: any) {
      setError(err.message || "Failed to revoke certificate.")
    } finally {
      setWorking(false)
    }
  }

  const list = (items: CertRow[], empty: string) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground py-6 text-center">{empty}</p>
    }
    return (
      <div className="space-y-3">
        {items.map((cert) => (
          <div
            key={cert.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium truncate">{cert.recipientName}</p>
                <Badge variant={cert.status === "active" ? "default" : "destructive"}>
                  {cert.status === "active" ? "Active" : "Revoked"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{cert.courseTitle}</p>
              <p className="text-xs font-mono text-muted-foreground break-all">{cert.certificate_number}</p>
              <p className="text-xs text-muted-foreground">
                Issued {new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
            {cert.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setPendingRevoke(cert)}
              >
                <Ban className="w-4 h-4" />
                Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-serif">Certificates</h1>
        <p className="text-muted-foreground">
          Review issued certificates and revoke credentials that should no longer verify as valid.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</p>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by recipient, course, or certificate number"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="revoked">Revoked ({revoked.length})</TabsTrigger>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Active certificates
              </CardTitle>
              <CardDescription>These still pass public verification.</CardDescription>
            </CardHeader>
            <CardContent>{list(active, "No active certificates.")}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="revoked" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revoked certificates</CardTitle>
              <CardDescription>Public verify reports these as revoked.</CardDescription>
            </CardHeader>
            <CardContent>{list(revoked, "No revoked certificates.")}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All certificates</CardTitle>
            </CardHeader>
            <CardContent>{list(filtered, "No certificates found.")}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingRevoke} onOpenChange={(o) => { if (!o) setPendingRevoke(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingRevoke?.certificate_number}&rdquo; for {pendingRevoke?.recipientName} (
              {pendingRevoke?.courseTitle}) will no longer verify as valid. The learner keeps the row as
              revoked; a new certificate can be issued later if they re-complete the course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (pendingRevoke) revoke(pendingRevoke)
              }}
            >
              {working ? "Revoking…" : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
