"use client"

import { useCallback, useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export function AssignmentPromptEditor({
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
  const [instructions, setInstructions] = useState("")
  const [passThreshold, setPassThreshold] = useState(70)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabaseBrowser
        .from("assignment_prompts")
        .select("instructions, pass_threshold")
        .eq("lesson_id", lessonId)
        .maybeSingle()
      if (qErr) throw new Error(qErr.message)
      if (data) {
        setInstructions(data.instructions ?? "")
        setPassThreshold(Number(data.pass_threshold) || 70)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load assignment prompt.")
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (!instructions.trim()) throw new Error("Add instructions for learners.")
      const { error: sErr } = await supabaseBrowser.from("assignment_prompts").upsert({
        lesson_id: lessonId,
        instructions: instructions.trim(),
        pass_threshold: passThreshold,
        updated_at: new Date().toISOString(),
      })
      if (sErr) throw new Error(sErr.message)
      setNotice("Assignment prompt saved.")
    } catch (err: any) {
      setError(err.message || "Failed to save prompt.")
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
        <CardTitle className="text-base">Assignment prompt</CardTitle>
        <CardDescription>
          Learners submit a text response. Score at or above the pass threshold completes the lesson.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}

        <div className="space-y-1">
          <Label>Instructions</Label>
          <Textarea
            rows={6}
            value={instructions}
            disabled={!editable}
            placeholder="Describe what learners should write…"
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

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

        {editable && (
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save prompt"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
