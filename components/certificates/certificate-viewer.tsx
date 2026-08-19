import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Award, Calendar, CheckCircle, MapPin, Building2 } from "lucide-react"
import type { Certificate } from "@/lib/types/database"

interface CertificateViewerProps {
  certificate: Certificate
}

export function CertificateViewer({ certificate }: CertificateViewerProps) {
  const certificateData = {
    id: certificate.certificate_number,
    recipientName: certificate.user?.name || "Unknown Recipient",
    courseName: certificate.course?.title || "Unknown Course",
    completionDate: certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString() : "N/A",
    issueDate: certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString() : "N/A",
    instructor: certificate.course?.instructor || "Unknown Instructor",
    organization: certificate.user?.organization || "N/A",
    userType: certificate.user?.user_type || "N/A",
    location: certificate.user?.city && certificate.user?.province
      ? `${certificate.user.city}, ${certificate.user.province.charAt(0).toUpperCase() + certificate.user.province.slice(1)}`
      : certificate.user?.province
        ? certificate.user.province.charAt(0).toUpperCase() + certificate.user.province.slice(1)
        : "N/A",
    grade: certificate.enrollment?.grade ? `${certificate.enrollment.grade}%` : "N/A",
    skills: certificate.course?.skills || [],
    verificationUrl: `https://sscacademy.dost02onedata.com/verify/${certificate.id}`,
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-12 relative">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-4 left-4 w-16 h-16 border-2 border-primary rounded-full"></div>
              <div className="absolute top-8 right-8 w-12 h-12 border-2 border-secondary rounded-full"></div>
              <div className="absolute bottom-8 left-8 w-8 h-8 border-2 border-primary rounded-full"></div>
              <div className="absolute bottom-4 right-4 w-20 h-20 border-2 border-secondary rounded-full"></div>
            </div>

            <div className="relative z-10 text-center space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                    <Award className="w-8 h-8 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-primary mb-2">Smart and Sustainable Communities Academy</h1>
                  <p className="text-lg text-muted-foreground">Cagayan Valley</p>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-4xl font-bold text-foreground font-serif">Certificate of Completion</h2>
                <div className="w-32 h-1 bg-primary mx-auto rounded-full"></div>
              </div>

              <div className="space-y-4">
                <p className="text-lg text-muted-foreground">This is to certify that</p>
                <h3 className="text-5xl font-bold text-foreground font-serif">{certificateData.recipientName}</h3>
                <div className="flex items-center justify-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">{certificateData.organization}</span>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-lg text-muted-foreground">has successfully completed the course</p>
                <h4 className="text-3xl font-bold text-primary font-serif">{certificateData.courseName}</h4>
                <p className="text-muted-foreground">Instructed by {certificateData.instructor}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="text-center">
                  <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-semibold">{certificateData.completionDate}</p>
                </div>
                <div className="text-center">
                  <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="font-semibold">{certificateData.grade}</p>
                </div>
                <div className="text-center">
                  <MapPin className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-semibold">{certificateData.location}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-muted-foreground">Skills Demonstrated:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {certificateData.skills.length > 0 ? (
                    certificateData.skills.map((skill: string) => (
                      <Badge key={skill} variant="secondary" className="text-sm">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No skills listed</p>
                  )}
                </div>
              </div>

              <div className="pt-8 border-t border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                  <div>
                    <div className="w-32 h-1 bg-muted mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Dr. Virginia G. Bilgera</p>
                    <p className="font-semibold">Regional Director</p>
                  </div>
                  <div>
                    <div className="w-32 h-1 bg-muted mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Certificate ID</p>
                    <p className="font-semibold font-mono text-sm">{certificateData.id}</p>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-xs text-muted-foreground">
                    Verify this certificate at: {certificateData.verificationUrl}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}