"use client"

import { CertificateVerification } from "@/components/certificates/certificate-verification"
import { Header } from "@/components/ui/header"

export default function VerifyByIdPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <CertificateVerification />
      </main>
    </div>
  )
}
