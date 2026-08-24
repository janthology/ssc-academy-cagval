import { Header } from "@/components/ui/header"
import { CertificateVerifyLookup } from "@/components/certificates/certificate-verify-lookup"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Verify Certificate | SSC Academy",
  description:
    "Publicly verify Smart & Sustainable Communities Academy certificates issued by DOST Region 02. No account required.",
}

export default function VerifyIndexPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <CertificateVerifyLookup />
      </main>
    </div>
  )
}
