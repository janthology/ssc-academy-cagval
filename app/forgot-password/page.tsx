import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpenText } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <BookOpenText className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-foreground">Smart and Sustainable Communities Academy</h1>
              <p className="text-sm text-muted-foreground">Cagayan Valley</p>
            </div>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-serif">Reset your password</CardTitle>
            <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
