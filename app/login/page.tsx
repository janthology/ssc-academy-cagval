import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpenText } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
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
            <CardTitle className="text-2xl font-serif">User Login</CardTitle>
            <CardDescription>Sign in to continue your SSC learning journey</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Register here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
