import { Header } from "@/components/ui/header"
import Link from "next/link"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Smart &amp; Sustainable Communities Academy · DOST Region 02
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            This platform collects account and learning data needed to deliver courses, track progress,
            issue certificates, and support organizational training for LGUs, academe, and partners.
          </p>
          <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
          <p>
            Name, email, organization type and affiliation, location (Region 02), profile photo if you
            upload one, course enrollments, progress, and certificates earned. Instructors and admins
            may also generate content and audit logs related to publishing and review.
          </p>
          <h2 className="text-lg font-semibold text-foreground">How we use it</h2>
          <p>
            To authenticate you, personalize your dashboard, measure learning outcomes, notify you of
            review decisions or certificates, and help organization-linked managers view team progress
            when your account is linked to an organization.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Certificates</h2>
          <p>
            Issued certificates can be verified through a public verification link. That verification
            flow is intentional so employers and partners can confirm credentials.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Retention &amp; access</h2>
          <p>
            Account and learning records are retained while your account is active and as required for
            Academy operations. Contact platform administrators for access or correction requests
            related to your personal data.
          </p>
        </div>

        <p className="text-sm">
          <Link href="/terms" className="text-primary underline underline-offset-2">
            Terms of Service
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
