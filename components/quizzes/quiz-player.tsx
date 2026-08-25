"use client"

import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Loader2, XCircle } from "lucide-react"

type QuizOption = { id: string; label: string; order: number }
type QuizQuestion = {
  id: string
  prompt: string
  order: number
  points: number
  options: QuizOption[]
}

export function QuizPlayer({
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
  const [threshold, setThreshold] = useState(70)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ score_pct: number; passed: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcErr } = await supabaseBrowser.rpc("get_quiz_for_take", {
          p_lesson_id: lessonId,
        })
        if (rpcErr) throw new Error(rpcErr.message)
        if (cancelled) return
        setThreshold(Number(data?.pass_threshold) || 70)
        setQuestions((data?.questions ?? []) as QuizQuestion[])
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load quiz.")
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
      for (const q of questions) {
        if (!answers[q.id]) throw new Error("Answer every question before submitting.")
      }
      const { data, error: rpcErr } = await supabaseBrowser.rpc("submit_quiz_attempt", {
        p_lesson_id: lessonId,
        p_answers: answers,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      const score = Number(data?.score_pct) || 0
      const passed = !!data?.passed
      setResult({ score_pct: score, passed })
      if (passed) onPassed(score)
    } catch (err: any) {
      setError(err.message || "Failed to submit quiz.")
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

  if (error && questions.length === 0) {
    return <p className="text-red-600 p-4">{error}</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lessonTitle}</CardTitle>
        <CardDescription>
          Pass with {threshold}% or higher to complete this lesson.
          {alreadyCompleted && !result ? " You already passed this quiz." : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div
            className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
              result.passed ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {result.passed ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            Score: {result.score_pct}% — {result.passed ? "Passed" : "Not passed. You can try again."}
          </div>
        )}

        {questions.map((q, i) => (
          <div key={q.id} className="space-y-2">
            <p className="font-medium">
              {i + 1}. {q.prompt}
            </p>
            <div className="space-y-2 pl-1">
              {q.options
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === o.id}
                      disabled={!!result?.passed || alreadyCompleted}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                    />
                    {o.label}
                  </label>
                ))}
            </div>
          </div>
        ))}

        {!alreadyCompleted && !result?.passed && (
          <Button onClick={submit} disabled={submitting || questions.length === 0}>
            {submitting ? "Submitting…" : "Submit quiz"}
          </Button>
        )}

        {alreadyCompleted && !result && (
          <p className="text-sm text-muted-foreground">Quiz already completed.</p>
        )}

        {result && !result.passed && (
          <Button
            variant="outline"
            onClick={() => {
              setResult(null)
              setAnswers({})
            }}
          >
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
