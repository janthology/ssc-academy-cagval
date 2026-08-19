import { Award, Calendar, CheckCircle, MapPin, Building2 } from "lucide-react"

interface CertificateTemplateProps {
  recipientName: string
  courseName: string
  completionDate: string
  instructor: string
  organization: string
  location: string
  grade: string
  skills: string[]
  certificateId: string
  className?: string
}

export function CertificateTemplate({
  recipientName,
  courseName,
  completionDate,
  instructor,
  organization,
  location,
  grade,
  skills,
  certificateId,
  className = "",
}: CertificateTemplateProps) {
  return (
    <div className={`bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-12 relative ${className}`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 left-4 w-16 h-16 border-2 border-primary rounded-full"></div>
        <div className="absolute top-8 right-8 w-12 h-12 border-2 border-secondary rounded-full"></div>
        <div className="absolute bottom-8 left-8 w-8 h-8 border-2 border-primary rounded-full"></div>
        <div className="absolute bottom-4 right-4 w-20 h-20 border-2 border-secondary rounded-full"></div>
      </div>

      <div className="relative z-10 text-center space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Award className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary mb-2">Cagayan Valley Smart City Academy</h1>
            <p className="text-lg text-muted-foreground">Smart City Education Platform</p>
          </div>
        </div>

        {/* Certificate Title */}
        <div className="space-y-4">
          <h2 className="text-4xl font-bold text-foreground font-serif">Certificate of Completion</h2>
          <div className="w-32 h-1 bg-primary mx-auto rounded-full"></div>
        </div>

        {/* Recipient */}
        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">This is to certify that</p>
          <h3 className="text-5xl font-bold text-foreground font-serif">{recipientName}</h3>
          <div className="flex items-center justify-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">{organization}</span>
          </div>
        </div>

        {/* Course Details */}
        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">has successfully completed the course</p>
          <h4 className="text-3xl font-bold text-primary font-serif">{courseName}</h4>
          <p className="text-muted-foreground">Instructed by {instructor}</p>
        </div>

        {/* Completion Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
          <div className="text-center">
            <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="font-semibold">{completionDate}</p>
          </div>
          <div className="text-center">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Grade</p>
            <p className="font-semibold">{grade}</p>
          </div>
          <div className="text-center">
            <MapPin className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-semibold">{location}</p>
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-4">
          <p className="text-muted-foreground">Skills Demonstrated:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 bg-secondary/20 text-secondary-foreground rounded-full text-sm border"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
            <div>
              <div className="w-32 h-1 bg-muted mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Digital Signature</p>
              <p className="font-semibold">SmartLearn Region 2</p>
            </div>
            <div>
              <div className="w-32 h-1 bg-muted mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Certificate ID</p>
              <p className="font-semibold font-mono text-sm">{certificateId}</p>
            </div>
          </div>
          <div className="mt-6">
            <p className="text-xs text-muted-foreground">
              Verify this certificate at: https://smartlearn-region2.vercel.app/verify/{certificateId}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
