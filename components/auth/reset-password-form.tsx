"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

type Phase = "checking" | "ready" | "invalid" | "done"

/**
 * Landing page for the emailed password-recovery link.
 *
 * Supabase can deliver the recovery session two ways depending on flow:
 *   - PKCE      -> ?code=... in the query string, exchanged for a session
 *   - implicit  -> #access_token=... in the URL fragment, picked up automatically
 * Both are handled below, plus the PASSWORD_RECOVERY auth event.
 *
 * A recovery link creates a real (if limited) session, which is what allows
 * updateUser() to set the new password. If no session can be established the
 * link is expired, already used, or was opened in a different browser than the
 * one that requested it (PKCE keeps the verifier in local storage).
 */
export function ResetPasswordForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("checking")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let settled = false

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        settled = true
        setPhase("ready")
      }
    })

    const establish = async () => {
      // Already have a session?
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (session) {
        settled = true
        setPhase("ready")
        return
      }

      // Implicit flow: tokens arrive in the URL fragment. The browser client is
      // configured for PKCE and does not necessarily consume these on its own,
      // so adopt them explicitly. (Supabase's default email template and
      // admin-generated recovery links both use this form.)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      const access_token = hash.get("access_token")
      const refresh_token = hash.get("refresh_token")
      if (access_token && refresh_token) {
        const { error: setErr } = await supabaseBrowser.auth.setSession({ access_token, refresh_token })
        if (!setErr) {
          settled = true
          // Drop the tokens from the address bar once adopted.
          window.history.replaceState({}, "", window.location.pathname)
          setPhase("ready")
          return
        }
      }

      // PKCE: exchange the ?code= param for a session.
      const code = new URLSearchParams(window.location.search).get("code")
      if (code) {
        const { error: exchangeError } = await supabaseBrowser.auth.exchangeCodeForSession(code)
        if (!exchangeError) {
          settled = true
          setPhase("ready")
          return
        }
      }

      // An expired or already-used link comes back with an error in the fragment.
      if (hash.get("error") || hash.get("error_code")) {
        settled = true
        setPhase("invalid")
        return
      }

      // Give the client a moment to process a URL fragment before giving up.
      setTimeout(async () => {
        if (settled) return
        const { data: { session: late } } = await supabaseBrowser.auth.getSession()
        setPhase(late ? "ready" : "invalid")
      }, 1500)
    }

    establish()
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSaving(true)
    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      // Force a fresh sign-in with the new password rather than continuing on
      // the recovery session.
      await supabaseBrowser.auth.signOut()
      setPhase("done")
      setTimeout(() => router.push("/login"), 2500)
    } catch {
      setError("Could not update the password. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (phase === "checking") {
    return (
      <div className="py-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        <p className="mt-2 text-sm text-muted-foreground">Verifying your reset link…</p>
      </div>
    )
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This reset link is invalid or has expired.
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          Reset links expire after a short time, can only be used once, and must be opened in the
          same browser that requested them. Please request a new one.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Your password has been updated. Redirecting you to sign in…
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            className="pl-10 pr-10"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-3 text-muted-foreground"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirm New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirm-new-password"
            type={showPassword ? "text" : "password"}
            className="pl-10"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isSaving}>
        {isSaving ? "Updating…" : "Update password"}
      </Button>
    </form>
  )
}
