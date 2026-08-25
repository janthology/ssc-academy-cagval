"use client"

import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Loader2, XCircle } from "lucide-react"

type Submission = {
  id: string
  body: string
  status: string
  score_pct: number | null
  feedback: string | null
  submitted_at: string
}

export function AssignmentPlayer({
  lessonId,
  lessonTitle,
  alreadyCompleted,
  onPassed,
}: {
  lessonId: string
  lessonTitle: string
  alreadyCompleted: boolean
  onPassed: (scorePct: number) => void
}) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instructions, setInstructions] = useState("")
  const [threshold, setThreshold] = useState(70)
  const [body, setBody] = useState("")
  const [submission, setSubmission] = useState<Submission | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: prompt, error: pErr } = await supabaseBrowser
          .from("assignment_prompts")
          .select("instructions, pass_threshold")
          .eq("lesson_id", lessonId)
          .maybeSingle()
        if (pErr) throw new Error(pErr.message)
        if (cancelled) return
        setInstructions(prompt?.instructions ?? "")
        setThreshold(Number(prompt?.pass_threshold) || 70)

        const { data: { user } } = await supabaseBrowser.auth.getUser()
        if (user?.id) {
          const { data: sub, error: sErr } = await supabaseBrowser
            .from("assignment_submissions")
            .select("id, body, status, score_pct, feedback, submitted_at")
            .eq("lesson_id", lessonId)
            .eq("user_id", user.id)
            .maybeSingle()
          if (sErr) throw new Error(sErr.message)
          if (cancelled) return
          if (sub) {
            setSubmission(sub as Submission)
            setBody(sub.body ?? "")
            if (sub.status === "graded" && sub.score_pct != null && sub.score_pct >= (Number(prompt?.pass_threshold) || 70)) {
              // already passed — parent may already have progress
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load assignment.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lessonId])

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (!body.trim()) throw new Error("Write your response before submitting.")
      const { data, error: rpcErr } = await supabaseBrowser.rpc("submit_assignment", {
        p_lesson_id: lessonId,
        p_body: body.trim(),
      })
      if (rpcErr) throw new Error(rpcErr.message)
      setSubmission({
        id: data.submission_id,
        body: body.trim(),
        status: "submitted",
        score_pct: null,
        feedback: null,
        submitted_at: new Date().toISOString(),
      })
    } catch (err: any) {
      setError(err.message || "Failed to submit.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  const isGraded = submission?.status === "graded"
  const isReturned = submission?.status === "returned"
  const isWaiting = submission?.status === "submitted"
  const passed =
    isGraded &&
    submission?.score_pct != null &&
    submission.score_pct >= threshold

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lessonTitle}</CardTitle>
        <CardDescription>
          Text response. Pass with {threshold}% or higher after instructor review.
          {alreadyCompleted && !submission ? " You already completed this assignment." : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {instructions ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {instructions}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No instructions published yet.</p>
        )}

        {isGraded && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              passed ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {passed ? <CheckCircle className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <div>
              <p>
                Score: {submission?.score_pct}% — {passed ? "Passed" : "Not passed"}
              </p>
              {submission?.feedback && (
                <p className="mt-1 opacity-90">Feedback: {submission.feedback}</p>
              )}
            </div>
          </div>
        )}

        {isReturned && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Returned for revision
            {submission?.score_pct != null ? ` (score ${submission.score_pct}%)` : ""}.
            {submission?.feedback ? ` Feedback: ${submission.feedback}` : " Update and resubmit."}
          </div>
        )}

        {isWaiting && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Submitted — waiting for instructor review.
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            rows={10}
            value={body}
            disabled={isWaiting || (isGraded && !!passed) || alreadyCompleted}
            placeholder="Write your response here…"
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {!alreadyCompleted && !(isGraded && passed) && !isWaiting && (
          <Button onClick={submit} disabled={submitting || !instructions}>
            {submitting ? "Submitting…" : isReturned ? "Resubmit" : "Submit assignment"}
          </Button>
        )}

        {alreadyCompleted && !submission && (
          <p className="text-sm text-muted-foreground">Assignment already completed.</p>
        )}
      </CardContent>
    </Card>
  )
}
