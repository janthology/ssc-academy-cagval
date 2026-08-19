"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, CheckCircle } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

/**
 * Password reset request. Sends a Supabase recovery email.
 *
 * SECURITY: the confirmation message is deliberately identical whether or not
 * the address belongs to an account, and any error from resetPasswordForEmail
 * is swallowed for the same reason — a differing response would let anyone test
 * which emails are registered on the platform (user enumeration).
 *
 * The reset link must be opened in THIS browser: the Supabase client uses the
 * PKCE flow, and the code verifier that completes the exchange lives in this
 * browser's storage.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setIsLoading(true)

    try {
      await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
    } catch {
      // Intentionally ignored — see the enumeration note above.
    } finally {
      setIsLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            If an account exists for <span className="font-medium">{email.trim()}</span>, a password
            reset link has been sent. Please check your inbox, and your spam folder.
          </AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">
          The link expires after a short time, and must be opened in this same browser.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => { setSent(false); setEmail("") }}>
            Send to a different address
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email Address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="reset-email"
            type="email"
            className="pl-10"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          We&apos;ll send a link to reset your password.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Sending…" : "Send reset link"}
      </Button>

      <div className="text-center">
        <Link href="/login" className="text-sm text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  )
}
