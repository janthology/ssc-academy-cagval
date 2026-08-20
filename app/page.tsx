"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/ui/header"
import { BookOpen, BookOpenText, Users, Award, Building2, GraduationCap } from "lucide-react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      setIsAuthenticated(!!user)
    }
    checkAuth()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-sky-50 via-background to-background px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="mb-3 text-sm font-semibold tracking-wide text-primary uppercase">
            DOST Region 02 · Cagayan Valley
          </p>
          <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Smart &amp; Sustainable Communities Academy
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Master SSCP implementation with courses for LGUs, academe, students, and private learners across Region 02.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="px-8 text-lg" asChild>
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                {isAuthenticated ? "Go to Dashboard" : "Start Learning"}
              </Link>
            </Button>
            <Button size="lg" variant="secondary" className="px-8 text-lg" asChild>
              <Link href="/courses">Browse Courses</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="py-10 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-foreground mb-4 font-serif">Who We Serve</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tailored learning experiences for different sectors driving smart city transformation
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Local Government Units</CardTitle>
                <CardDescription>LGUs Implementing Smart City solutions</CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <GraduationCap className="w-12 h-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Universities & Colleges</CardTitle>
                <CardDescription>SUCs and HEIs Advancing Research</CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Users className="w-12 h-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Government Agencies</CardTitle>
                <CardDescription>DOST and other Agencies</CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <BookOpen className="w-12 h-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Individual Learners</CardTitle>
                <CardDescription>Individuals / Professionals</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-foreground mb-4 font-serif">Platform Features</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to master smart city technologies and earn recognized certifications
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <BookOpen className="w-10 h-10 text-primary mb-4" />
                <CardTitle>Comprehensive Modules</CardTitle>
                <CardDescription>
                  Structured learning paths covering SSCP fundamentals, IoT, data analytics, urban planning, and more
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="w-10 h-10 text-primary mb-4" />
                <CardTitle>Role-Based Learning</CardTitle>
                <CardDescription>Customized content and tracks based on your organization and role</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Award className="w-10 h-10 text-primary mb-4" />
                <CardTitle>Certified Completion</CardTitle>
                <CardDescription>Earn recognized certificates for each course completed</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h3 className="text-3xl font-bold mb-6 font-serif">Ready to Transform Your City?</h3>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of learners across Region 2 who are already building smarter, more sustainable communities.
          </p>
          <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
            <Link href="/learning-paths">Start Your Journey</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <BookOpenText className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold">Smart and Sustainable Communities Academy Cagayan Valley</span>
              </div>
              <p className="text-sm text-muted-foreground">Empowering smart city transformation through education</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/courses" className="hover:text-foreground">
                    Courses
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/certificates" className="hover:text-foreground">
                    Certificates
                  </Link>
                </li>
                <li>
                  <Link href="/learning-paths" className="hover:text-foreground">
                    Learning Paths
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Region 2</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Cagayan Valley</li>
                <li>Smart City Initiative</li>
                <li>DOST Partnership</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 DOST Region 02 - SSCP. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}