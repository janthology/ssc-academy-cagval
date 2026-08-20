"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Search, MoreHorizontal, Building2, MapPin, Mail, Shield, GraduationCap, Loader2, UserCheck, UserX, Check } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { recordAdminAction } from "@/lib/admin/log-client"

type Status = "active" | "pending" | "inactive"
type UserRow = {
  id: string
  name: string
  email: string
  organization: string | null
  position: string | null
  user_type: string
  status: Status
  region: string | null
  province: string | null
  city: string | null
  is_admin: boolean | null
  is_instructor: boolean | null
  completedCourses: number
  certificates: number
}

const TYPE_LABEL: Record<string, string> = {
  individual: "Individual", lgu: "LGU", suc: "SUC", hei: "HEI", dost: "DOST", government: "Government",
}
const STATUS_VARIANT: Record<Status, "default" | "secondary" | "destructive"> = {
  active: "default", pending: "secondary", inactive: "destructive",
}

export function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [working, setWorking] = useState(false)
  const [pendingSuspend, setPendingSuspend] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Admin reads all users via users_admin_all RLS.
      const { data, error: qErr } = await supabaseBrowser
        .from("users")
        .select("id, name, email, organization, position, user_type, status, region, province, city, is_admin, is_instructor")
        .order("name")
      if (qErr) throw new Error(qErr.message)

      const { data: enr } = await supabaseBrowser.from("enrollments").select("user_id, status")
      const { data: certs } = await supabaseBrowser.from("certificates").select("user_id")
      const completedByUser: Record<string, number> = {}
      for (const e of enr ?? []) if (e.status === "completed") completedByUser[e.user_id] = (completedByUser[e.user_id] || 0) + 1
      const certsByUser: Record<string, number> = {}
      for (const c of certs ?? []) certsByUser[c.user_id] = (certsByUser[c.user_id] || 0) + 1

      setUsers((data ?? []).map((u: any) => ({
        ...u,
        status: (u.status ?? "active") as Status,
        completedCourses: completedByUser[u.id] ?? 0,
        certificates: certsByUser[u.id] ?? 0,
      })))
    } catch (err: any) {
      setError(err.message || "Failed to load users.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (user: UserRow, next: Status) => {
    setWorking(true)
    try {
      const { error: uErr } = await supabaseBrowser.from("users").update({ status: next }).eq("id", user.id)
      if (uErr) throw new Error(uErr.message)
      // Action name depends on the transition (approve vs reactivate both -> active).
      const action =
        next === "inactive" ? "user_suspended"
        : user.status === "pending" ? "user_approved"
        : "user_reactivated"
      const verb = action === "user_suspended" ? "suspended" : action === "user_approved" ? "approved" : "reactivated"
      recordAdminAction(action, user.id, { message: `User ${verb}: ${user.name}` })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: next } : u)))
    } catch (err: any) {
      setError(err.message || "Failed to update user status.")
    } finally {
      setWorking(false)
      setPendingSuspend(null)
    }
  }

  const setInstructor = async (user: UserRow, enable: boolean) => {
    setWorking(true)
    try {
      // Instructor pages + RLS depend on BOTH:
      //   - users.is_instructor = true/false
      //   - users.status = 'active' when enabled
      const payload: Partial<UserRow> & { is_instructor: boolean; status?: Status } = {
        is_instructor: enable,
      }
      const nextStatus: Status = enable ? "active" : user.status
      payload.status = nextStatus

      const { error: uErr } = await supabaseBrowser
        .from("users")
        .update(payload as any)
        .eq("id", user.id)
      if (uErr) throw new Error(uErr.message)

      const action = enable ? "instructor_enabled" : "instructor_disabled"
      const verb = enable ? "enabled" : "disabled"
      recordAdminAction(action, user.id, { message: `Instructor ${verb}: ${user.name}` })

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                is_instructor: enable,
                status: nextStatus,
              }
            : u
        )
      )
    } catch (err: any) {
      setError(err.message || "Failed to update instructor status.")
    } finally {
      setWorking(false)
      setPendingSuspend(null)
    }
  }

  const typeStats = useMemo(() => {
    const total = users.length || 1
    const byType: Record<string, number> = {}
    for (const u of users) byType[u.user_type] = (byType[u.user_type] || 0) + 1
    return Object.keys(TYPE_LABEL).map((t) => ({
      type: TYPE_LABEL[t], count: byType[t] || 0, percentage: Math.round(((byType[t] || 0) / total) * 100),
    }))
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.organization ?? "").toLowerCase().includes(q))
  }, [users, search])

  const byStatus = (s: Status) => filtered.filter((u) => u.status === s)

  const initials = (name: string) => name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()

  const UserItem = ({ user }: { user: UserRow }) => (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <Avatar className="h-12 w-12"><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold">{user.name}</h4>
          <Badge variant={STATUS_VARIANT[user.status]} className="capitalize">{user.status}</Badge>
          <Badge variant="outline">{TYPE_LABEL[user.user_type] ?? user.user_type}</Badge>
          {user.is_admin && <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3" />Admin</Badge>}
          {user.is_instructor && <Badge variant="secondary" className="gap-1"><GraduationCap className="w-3 h-3" />Instructor</Badge>}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</div>
          {user.organization && <div className="flex items-center gap-1"><Building2 className="w-3 h-3" />{user.organization}</div>}
          {(user.region || user.province) && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[user.city, user.province, user.region].filter(Boolean).join(", ")}</div>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>{user.completedCourses} courses completed</span>
          <span>{user.certificates} certificates earned</span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.is_instructor ? (
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (working) return
                setInstructor(user, false)
              }}
            >
              <UserX className="w-4 h-4 mr-2" /> Remove Instructor
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                if (working) return
                setInstructor(user, true)
              }}
            >
              <GraduationCap className="w-4 h-4 mr-2" /> Make Instructor
            </DropdownMenuItem>
          )}

          {user.status === "pending" && (
            <DropdownMenuItem onClick={() => setStatus(user, "active")}><Check className="w-4 h-4 mr-2" />Approve</DropdownMenuItem>
          )}
          {user.status === "active" && (
            <DropdownMenuItem className="text-destructive" onClick={() => setPendingSuspend(user)}><UserX className="w-4 h-4 mr-2" />Suspend</DropdownMenuItem>
          )}
          {user.status === "inactive" && (
            <DropdownMenuItem onClick={() => setStatus(user, "active")}><UserCheck className="w-4 h-4 mr-2" />Reactivate</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const list = (rows: UserRow[], empty: string) => (
    <div className="space-y-4">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      {rows.map((u) => <UserItem key={u.id} user={u} />)}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">User Management</h1>
          <p className="text-muted-foreground">Manage platform users and organizations</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4"><div className="text-center">
            <div className="text-2xl font-bold">{loading ? "—" : users.length}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div></CardContent>
        </Card>
        {typeStats.map((stat) => (
          <Card key={stat.type}>
            <CardContent className="p-4"><div className="text-center">
              <div className="text-2xl font-bold">{loading ? "—" : stat.count}</div>
              <div className="text-sm text-muted-foreground">{stat.type}</div>
              <div className="text-xs text-muted-foreground">{loading ? "" : `${stat.percentage}%`}</div>
            </div></CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({byStatus("active").length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
            <TabsTrigger value="inactive">Suspended ({byStatus("inactive").length})</TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-10 w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <>
            <TabsContent value="all">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />All Users</CardTitle><CardDescription>Complete list of platform users.</CardDescription></CardHeader>
                <CardContent>{list(filtered, "No users found.")}</CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="active">
              <Card><CardHeader><CardTitle>Active Users</CardTitle><CardDescription>Full access to the platform.</CardDescription></CardHeader>
                <CardContent>{list(byStatus("active"), "No active users.")}</CardContent></Card>
            </TabsContent>
            <TabsContent value="pending">
              <Card><CardHeader><CardTitle>Pending Users</CardTitle><CardDescription>Awaiting approval — approve to grant active access.</CardDescription></CardHeader>
                <CardContent>{list(byStatus("pending"), "No pending users.")}</CardContent></Card>
            </TabsContent>
            <TabsContent value="inactive">
              <Card><CardHeader><CardTitle>Suspended Users</CardTitle><CardDescription>Access blocked (status=inactive). Reactivate to restore.</CardDescription></CardHeader>
                <CardContent>{list(byStatus("inactive"), "No suspended users.")}</CardContent></Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      <AlertDialog open={!!pendingSuspend} onOpenChange={(o) => { if (!o) setPendingSuspend(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend this user?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingSuspend?.name}&rdquo; will be set to <strong>inactive</strong>. They lose access to
              protected areas and can no longer create or edit content (instructor/admin writes are blocked while
              inactive). Nothing is deleted — their account, enrollments and certificates are kept, and you can
              reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(e) => { e.preventDefault(); if (pendingSuspend) setStatus(pendingSuspend, "inactive") }}>
              {working ? "Suspending..." : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
