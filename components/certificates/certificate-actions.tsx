"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Share2, Link2, Mail, Copy, CheckCircle } from "lucide-react"
import type { Certificate } from "@/lib/types/database"

interface CertificateActionsProps {
  certificate: Certificate
}

export function CertificateActions({ certificate }: CertificateActionsProps) {
  const [copied, setCopied] = useState(false)
  const verificationUrl = `https://sscacademy.dost02onedata.com/verify/${certificate.id}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = async () => {
    try {
      const url = `/certificates/${certificate.id}/download`
      const response = await fetch(url)
      if (!response.ok) {
        let errorMessage = "Failed to download PDF"
        try {
          const contentType = response.headers.get("content-type")
          if (contentType?.includes("application/json")) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`
            }
          } else {
            const text = await response.text()
            errorMessage += `: Server returned ${response.status} (${text.slice(0, 50)}...)`
          }
        } catch (jsonError) {
          errorMessage += ": Unable to parse error response"
        }
        throw new Error(errorMessage)
      }
      const blob = await response.blob()
      const urlObj = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = urlObj
      link.download = `certificate-${certificate.certificate_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(urlObj)
    } catch (err: any) {
      alert(`Failed to download PDF: ${err.message}`)
    }
  }

  const handleShareEmail = () => {
    const subject = `My SmartLearn Region 2 Certificate: ${certificate.course?.title || "Certificate"}`
    const body = `I've completed "${certificate.course?.title || "a course"}" on SmartLearn Region 2! Verify my certificate at: ${verificationUrl}`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download & Share
          </CardTitle>
          <CardDescription>Get your certificate in different formats and share your achievement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleDownloadPDF} className="gap-2 cursor-pointer">
              <Download className="w-4 h-4" />
              PDF
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" disabled>
              <Download className="w-4 h-4" />
              PNG
            </Button>
          </div>

          <div className="space-y-3">
            <Label>Share via</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleShareEmail} className="gap-2 bg-transparent cursor-pointer">
                <Mail className="w-4 h-4" />
                Email
              </Button>
              <Button variant="outline" className="gap-2 bg-transparent" disabled>
                <Share2 className="w-4 h-4" />
                LinkedIn
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verification Link</Label>
            <div className="flex gap-2">
              <Input value={verificationUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2 bg-transparent">
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Certificate Details
          </CardTitle>
          <CardDescription>Verification information and certificate metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Certificate ID:</span>
              <span className="font-mono">{certificate.certificate_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issue Date:</span>
              <span>{certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString() : "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={certificate.status === "active" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {certificate.status.charAt(0).toUpperCase() + certificate.status.slice(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Blockchain Hash:</span>
              <span className="font-mono text-xs">{certificate.verification_hash?.slice(0, 8) || "N/A"}...</span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Digital Signature</p>
            <div className="bg-muted/50 p-3 rounded text-xs font-mono break-all">
              {certificate.verification_hash || "N/A"}
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2 bg-transparent" disabled>
            <Link2 className="w-4 h-4" />
            View on Blockchain
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}