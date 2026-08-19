import { LearningPathGrid } from "@/components/learning-paths/learning-path-grid"
import { Header } from "@/components/ui/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Route, Users, Building2, GraduationCap } from "lucide-react"

export default function LearningPathsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Route className="w-5 h-5 text-primary" />
            <Badge variant="secondary">Structured Learning</Badge>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4 font-serif">Learning Paths</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            A learning platform that empowers LGUs, academe, students, and private individuals to co-create Smart and Sustainable Communities.
          </p>
        </div>

        {/* User Type Paths */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="text-center p-6 border rounded-lg hover:shadow-lg transition-shadow">
            <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">LGU Officials</h3>
            <p className="text-muted-foreground mb-4">Strategic planning and implementation for local government units</p>
          </div>

          <div className="text-center p-6 border rounded-lg hover:shadow-lg transition-shadow">
            <Users className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Technical Professionals</h3>
            <p className="text-muted-foreground mb-4">Implementation and technical skills development</p>
          </div>

          <div className="text-center p-6 border rounded-lg hover:shadow-lg transition-shadow">
            <GraduationCap className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Academic Researchers</h3>
            <p className="text-muted-foreground mb-4">Research methodologies and advanced smart city concepts</p>
          </div>

        </div>

        <LearningPathGrid />
      </div>
    </div>
  )
}