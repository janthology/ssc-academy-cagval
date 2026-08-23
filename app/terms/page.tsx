import { Header } from "@/components/ui/header"
import Link from "next/link"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Smart &amp; Sustainable Communities Academy · DOST Region 02
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            By creating an account or using this platform, you agree to use it for legitimate learning
            related to smart and sustainable communities capacity-building under DOST Region 02.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Accounts</h2>
          <p>
            You are responsible for keeping your login credentials secure and for activity under your
            account. Provide accurate registration information, including organization type where requested.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Learning content</h2>
          <p>
            Course materials, certificates, and related resources are provided for personal and
            institutional learning. Do not redistribute paid or restricted materials without permission.
            Certificates may be verified publicly via their verification link.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Acceptable use</h2>
          <p>
            Do not attempt to disrupt the service, bypass access controls, upload malicious content, or
            misuse instructor/admin privileges. Accounts may be suspended for policy violations.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Changes</h2>
          <p>
            These terms may be updated as the Academy evolves. Continued use after changes constitutes
            acceptance of the updated terms.
          </p>
        </div>

        <p className="text-sm">
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/register" className="text-primary underline underline-offset-2">
            Back to registration
          </Link>
        </p>
      </main>
    </div>
  )
}
