"use client"

import { useCallback, useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList, Loader2 } from "lucide-react"

type QueueRow = {
  id: string
  body: string
  status: string
  score_pct: number | null
  feedback: string | null
  submitted_at: string
  lesson_id: string
  lessonTitle: string
  learnerName: string
  learnerEmail: string
  pass_threshold: number
}

export function AssignmentGradeQueue({
  courseId,
  onGraded,
}: {
  courseId: string
  onGraded?: () => void
}) {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [score, setScore] = useState("80")
  const [feedback, setFeedback] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabaseBrowser
        .from("assignment_submissions")
        .select("id, body, status, score_pct, feedback, submitted_at, lesson_id, user_id, user:users(name, email), lesson:lessons(title)")
        .eq("course_id", courseId)
        .in("status", ["submitted", "returned", "graded"])
        .order("submitted_at", { ascending: false })
      if (qErr) throw new Error(qErr.message)

      const lessonIds = [...new Set((data ?? []).map((r: any) => r.lesson_id).filter(Boolean))]
      let thresholds: Record<string, number> = {}
      if (lessonIds.length > 0) {
        const { data: prompts } = await supabaseBrowser
          .from("assignment_prompts")
          .select("lesson_id, pass_threshold")
          .in("lesson_id", lessonIds)
        for (const p of prompts ?? []) {
          thresholds[p.lesson_id] = Number(p.pass_threshold) || 70
        }
      }

      setRows(
        (data ?? []).map((r: any) => {
          const u = Array.isArray(r.user) ? r.user[0] : r.user
          const lesson = Array.isArray(r.lesson) ? r.lesson[0] : r.lesson
          return {
            id: r.id,
            body: r.body,
            status: r.status,
            score_pct: r.score_pct,
            feedback: r.feedback,
            submitted_at: r.submitted_at,
            lesson_id: r.lesson_id,
            lessonTitle: lesson?.title ?? "Assignment",
            learnerName: u?.name ?? "Learner",
            learnerEmail: u?.email ?? "",
            pass_threshold: thresholds[r.lesson_id] ?? 70,
          }
        })
      )
    } catch (err: any) {
      setError(err.message || "Failed to load submissions.")
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const active = rows.find((r) => r.id === activeId) ?? null
  const pending = rows.filter((r) => r.status === "submitted")

  const grade = async (returnForRevision: boolean) => {
    if (!active) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const scoreNum = Number(score)
      if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        throw new Error("Score must be between 0 and 100.")
      }
      const { data, error: rpcErr } = await supabaseBrowser.rpc("grade_assignment", {
        p_submission_id: active.id,
        p_score_pct: scoreNum,
        p_feedback: feedback.trim() || null,
        p_return: returnForRevision,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      setNotice(
        data?.passed
          ? `Graded ${data.score_pct}% — passed; lesson marked complete.`
          : returnForRevision
            ? `Returned at ${data.score_pct}% for revision.`
            : `Graded ${data.score_pct}% — below pass threshold.`
      )
      if (data?.passed) {
        // optional: parent could refresh roster; we reload queue
      }
      setActiveId(null)
      setFeedback("")
      await load()
      onGraded?.()
    } catch (err: any) {
      setError(err.message || "Failed to grade.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Assignment submissions
        </CardTitle>
        <CardDescription>
          Review text submissions. Passing scores mark the assignment lesson complete.
          {pending.length > 0 ? ` ${pending.length} awaiting review.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No submissions yet.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`w-full text-left rounded-md border p-3 hover:bg-muted/50 ${
                    activeId === r.id ? "border-primary bg-muted/40" : ""
                  }`}
                  onClick={() => {
                    setActiveId(r.id)
                    setScore(r.score_pct != null ? String(r.score_pct) : "80")
                    setFeedback(r.feedback ?? "")
                    setNotice(null)
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{r.learnerName}</p>
                    <Badge variant={r.status === "submitted" ? "default" : "secondary"}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.submitted_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>

            <div className="border rounded-md p-4 space-y-3 min-h-[12rem]">
              {!active ? (
                <p className="text-sm text-muted-foreground">Select a submission to review.</p>
              ) : (
                <>
                  <div>
                    <p className="font-medium">{active.learnerName}</p>
                    <p className="text-xs text-muted-foreground">{active.learnerEmail}</p>
                    <p className="text-sm mt-1">{active.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Pass threshold: {active.pass_threshold}%
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {active.body}
                  </div>
                  {active.status === "submitted" || active.status === "returned" ? (
                    <>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="space-y-1 w-28">
                          <Label>Score %</Label>
                          <Input value={score} onChange={(e) => setScore(e.target.value)} type="number" min={0} max={100} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Feedback (optional)</Label>
                        <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => grade(false)} disabled={busy}>
                          {busy ? "Saving…" : "Save grade"}
                        </Button>
                        <Button variant="outline" onClick={() => grade(true)} disabled={busy}>
                          Return for revision
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Already graded at {active.score_pct}%.
                      {active.feedback ? ` Feedback: ${active.feedback}` : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
