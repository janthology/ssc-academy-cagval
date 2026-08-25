"use client"

import { useCallback, useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Loader2 } from "lucide-react"

type OptionDraft = { id?: string; label: string; is_correct: boolean }
type QuestionDraft = {
  id?: string
  prompt: string
  points: number
  options: OptionDraft[]
}

export function QuizEditor({
  lessonId,
  editable,
}: {
  lessonId: string
  editable: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [passThreshold, setPassThreshold] = useState(70)
  const [questions, setQuestions] = useState<QuestionDraft[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: settings } = await supabaseBrowser
        .from("quiz_settings")
        .select("pass_threshold")
        .eq("lesson_id", lessonId)
        .maybeSingle()
      if (settings?.pass_threshold != null) setPassThreshold(Number(settings.pass_threshold))

      const { data: qs, error: qErr } = await supabaseBrowser
        .from("quiz_questions")
        .select("id, prompt, points, order, quiz_options(id, label, is_correct, order)")
        .eq("lesson_id", lessonId)
        .order("order")
      if (qErr) throw new Error(qErr.message)

      setQuestions(
        (qs ?? []).map((q: any) => ({
          id: q.id,
          prompt: q.prompt,
          points: Number(q.points) || 1,
          options: (q.quiz_options ?? [])
            .sort((a: any, b: any) => a.order - b.order)
            .map((o: any) => ({
              id: o.id,
              label: o.label,
              is_correct: !!o.is_correct,
            })),
        }))
      )
    } catch (err: any) {
      setError(err.message || "Failed to load quiz.")
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    load()
  }, [load])

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        prompt: "",
        points: 1,
        options: [
          { label: "", is_correct: true },
          { label: "", is_correct: false },
        ],
      },
    ])
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      for (const q of questions) {
        if (!q.prompt.trim()) throw new Error("Every question needs a prompt.")
        if (q.options.length < 2) throw new Error("Each question needs at least two options.")
        if (!q.options.some((o) => o.is_correct)) throw new Error("Each question needs one correct option.")
        if (q.options.filter((o) => o.is_correct).length !== 1) {
          throw new Error("Each question must have exactly one correct option.")
        }
        if (q.options.some((o) => !o.label.trim())) throw new Error("Option labels cannot be empty.")
      }

      const { error: sErr } = await supabaseBrowser.from("quiz_settings").upsert({
        lesson_id: lessonId,
        pass_threshold: passThreshold,
      })
      if (sErr) throw new Error(sErr.message)

      // Replace questions wholesale for this lesson.
      const { error: delErr } = await supabaseBrowser.from("quiz_questions").delete().eq("lesson_id", lessonId)
      if (delErr) throw new Error(delErr.message)

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const { data: inserted, error: iErr } = await supabaseBrowser
          .from("quiz_questions")
          .insert({
            lesson_id: lessonId,
            prompt: q.prompt.trim(),
            points: q.points,
            order: i + 1,
          })
          .select("id")
          .single()
        if (iErr) throw new Error(iErr.message)

        const { error: oErr } = await supabaseBrowser.from("quiz_options").insert(
          q.options.map((o, oi) => ({
            question_id: inserted.id,
            label: o.label.trim(),
            is_correct: o.is_correct,
            order: oi + 1,
          }))
        )
        if (oErr) throw new Error(oErr.message)
      }

      setNotice("Quiz saved.")
      await load()
    } catch (err: any) {
      setError(err.message || "Failed to save quiz.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quiz questions</CardTitle>
        <CardDescription>
          Learners must score at least the pass threshold to complete this quiz lesson.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}

        <div className="flex items-end gap-3 max-w-xs">
          <div className="space-y-1 flex-1">
            <Label>Pass threshold (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={passThreshold}
              disabled={!editable}
              onChange={(e) => setPassThreshold(Number(e.target.value))}
            />
          </div>
        </div>

        {questions.length === 0 && (
          <p className="text-sm text-muted-foreground">No questions yet. Add at least one before publishing.</p>
        )}

        {questions.map((q, qi) => (
          <div key={qi} className="border rounded-lg p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={`Question ${qi + 1}`}
                value={q.prompt}
                disabled={!editable}
                onChange={(e) => {
                  const next = [...questions]
                  next[qi] = { ...q, prompt: e.target.value }
                  setQuestions(next)
                }}
              />
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="space-y-2 pl-2">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={o.is_correct}
                    disabled={!editable}
                    onChange={() => {
                      const next = [...questions]
                      next[qi] = {
                        ...q,
                        options: q.options.map((opt, idx) => ({
                          ...opt,
                          is_correct: idx === oi,
                        })),
                      }
                      setQuestions(next)
                    }}
                    aria-label="Mark as correct"
                  />
                  <Input
                    placeholder={`Option ${oi + 1}`}
                    value={o.label}
                    disabled={!editable}
                    onChange={(e) => {
                      const next = [...questions]
                      const opts = [...q.options]
                      opts[oi] = { ...o, label: e.target.value }
                      next[qi] = { ...q, options: opts }
                      setQuestions(next)
                    }}
                  />
                  {editable && q.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = [...questions]
                        next[qi] = {
                          ...q,
                          options: q.options.filter((_, idx) => idx !== oi),
                        }
                        setQuestions(next)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    const next = [...questions]
                    next[qi] = {
                      ...q,
                      options: [...q.options, { label: "", is_correct: false }],
                    }
                    setQuestions(next)
                  }}
                >
                  <Plus className="w-3 h-3" />
                  Option
                </Button>
              )}
            </div>
          </div>
        ))}

        {editable && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={addQuestion}>
              <Plus className="w-4 h-4" />
              Add question
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save quiz"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
