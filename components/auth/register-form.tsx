"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, Mail, Lock, User, Building2, MapPin, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { OrganizationPicker } from "@/components/organizations/organization-picker"

// Hardcoded provinces and cities for Region 2
const region2Locations = {
  batanes: [
    "Basco",
    "Itbayat",
    "Ivana",
    "Mahatao",
    "Sabtang",
    "Uyugan"
  ],
  cagayan: [
    "Tuguegarao City",
    "Abulug",
    "Alcala",
    "Allacapan",
    "Amulung",
    "Aparri",
    "Baggao",
    "Ballesteros",
    "Buguey",
    "Calayan",
    "Camalaniugan",
    "Claveria",
    "Enrile",
    "Gattaran",
    "Gonzaga",
    "Iguig",
    "Lal-lo",
    "Lasam",
    "Pamplona",
    "Peñablanca",
    "Piat",
    "Rizal",
    "Sanchez-Mira",
    "Santa Ana",
    "Santa Praxedes",
    "Santa Teresita",
    "Santo Niño",
    "Solana",
    "Tuao"
  ],
  isabela: [
    "Alicia",
    "Angadanan",
    "Aurora",
    "Benito Soliven",
    "Burgos",
    "Cabagan",
    "Cabatuan",
    "Cauayan City",
    "Cordon",
    "Delfin Albano",
    "Dinapigue",
    "Divilacan",
    "Echague",
    "Gamu",
    "Ilagan City",
    "Jones",
    "Luna",
    "Maconacon",
    "Mallig",
    "Naguilian",
    "Palanan",
    "Quezon",
    "Quirino",
    "Ramon",
    "Reina Mercedes",
    "Roxas",
    "San Agustin",
    "San Guillermo",
    "San Isidro",
    "San Manuel",
    "San Mariano",
    "San Mateo",
    "San Pablo",
    "Santa Maria",
    "Santiago City",
    "Santo Tomas",
    "Tumauini"
  ],
  "nueva-vizcaya": [
    "Alfonso Castañeda",
    "Ambaguio",
    "Aritao",
    "Bagabag",
    "Bambang",
    "Bayombong",
    "Diadi",
    "Dupax del Norte",
    "Dupax del Sur",
    "Kasibu",
    "Kayapa",
    "Quezon",
    "Santa Fe",
    "Solano",
    "Villaverde"
  ],
  quirino: [
    "Aglipay",
    "Cabarroguis",
    "Diffun",
    "Maddela",
    "Nagtipunan",
    "Saguday"
  ]
}

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    userType: "",
    organization: "",
    organizationId: null as string | null,
    position: "",
    province: "", // Renamed from location to match database
    city: "",
    agreeToTerms: false,
  })

  // Auto-populate organization for LGU users when city is selected
  // For LGU users, auto-populate organization from the selected city + province.
  // Non-LGU users type their own organization; switching user type or province is
  // handled by those Select onValueChange handlers (which clear the LGU-only
  // fields), so this effect must NOT reset organization for non-LGU users —
  // doing so wiped a manually-entered organization whenever province changed.
  useEffect(() => {
    if (formData.userType === "lgu" && formData.city && formData.province) {
      const formattedProvince = formData.province.charAt(0).toUpperCase() + formData.province.slice(1)
      setFormData((prev) => ({
        ...prev,
        organization: `LGU ${formData.city}, ${formattedProvince}`,
        // The derived name is still resolved against the registry by the
        // picker's exact-match rule; it only links if an entry matches exactly.
        organizationId: null,
      }))
    }
  }, [formData.userType, formData.city, formData.province])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" })
      setIsLoading(false)
      return
    }

    // Validate password length
    if (formData.password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters long" })
      setIsLoading(false)
      return
    }

    // Validate city for LGU users
    if (formData.userType === "lgu" && !formData.city) {
      setMessage({ type: "error", text: "City is required for LGU users" })
      setIsLoading(false)
      return
    }

    try {
      // Sign up user with Supabase auth. A duplicate email is surfaced by
      // signUp()'s own error below (the previous anon pre-check could not read
      // the users table under RLS, so it was removed).
      const { data: authData, error: authError } = await supabaseBrowser.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (authError) {
        setMessage({ type: "error", text: authError.message })
        setIsLoading(false)
        return
      }

      if (!authData.user) {
        setMessage({ type: "error", text: "Failed to create user" })
        setIsLoading(false)
        return
      }

      // If email confirmation is enabled in Supabase Auth, signUp() returns a
      // user but NO session until the user confirms via the emailed link. That
      // is a success, not an error — guide them to their inbox. The profile row
      // is inserted below only when a session exists (confirmation off).
      if (!authData.session) {
        setMessage({
          type: "success",
          text: "Account created. Please check your email to confirm your account, then sign in.",
        })
        setIsLoading(false)
        return
      }

      // Insert user data into users table
      const { error: dbError } = await supabaseBrowser.from('users').insert({
        id: authData.user.id,
        email: formData.email,
        name: `${formData.firstName} ${formData.lastName}`,
        user_type: formData.userType as "individual" | "lgu" | "suc" | "hei" | "dost" | "government",
        // Trimmed so the stored free text matches what the picker and the
        // migration backfill both treat as an exact name.
        organization: formData.organization.trim(),
        organization_id: formData.organizationId,
        position: formData.position,
        region: "Region 2",
        province: formData.province,
        city: formData.city,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (dbError) {
        setMessage({ type: "error", text: `Failed to save user data: ${dbError.message}` })
        setIsLoading(false)
        return
      }

      setMessage({ type: "success", text: "Account created successfully! Redirecting to login..." })

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        userType: "",
        organization: "",
        organizationId: null,
        position: "",
        province: "",
        city: "",
        agreeToTerms: false,
      })

      setTimeout(() => {
        window.location.href = "/login"
      }, 2000)
    } catch (err: any) {
      setMessage({ type: "error", text: "Registration failed: " + (err.message || "Unknown error") })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <Alert className={message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={message.type === "success" ? "text-green-600" : "text-red-600"}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="firstName"
              placeholder="First name"
              className="pl-10"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Last name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            className="pl-10"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="userType">Organization Type</Label>
        <Select value={formData.userType} onValueChange={(value) => setFormData({ ...formData, userType: value, province: "", city: "", organization: "", organizationId: null })}>
          <SelectTrigger>
            <Building2 className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Select your organization type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Individual Learner</SelectItem>
            <SelectItem value="lgu">Local Government Unit (LGU)</SelectItem>
            <SelectItem value="suc">State University/College (SUC)</SelectItem>
            <SelectItem value="hei">Higher Education Institution (HEI)</SelectItem>
            <SelectItem value="dost">DOST Personnel</SelectItem>
            <SelectItem value="government">Other Government Agency</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="organization">Organization/Institution Name</Label>
        <OrganizationPicker
          value={formData.organization}
          organizationId={formData.organizationId}
          onChange={({ organization, organization_id }) =>
            setFormData((prev) => ({ ...prev, organization, organizationId: organization_id }))
          }
          disabled={formData.userType === "lgu"}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="position">Position/Role</Label>
        <Input
          id="position"
          placeholder="Your position or role"
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="province">Province in Region 2</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Select
            value={formData.province}
            onValueChange={(value) => setFormData({ ...formData, province: value, city: "", organization: formData.userType === "lgu" ? "" : formData.organization, organizationId: formData.userType === "lgu" ? null : formData.organizationId })}
          >
            <SelectTrigger className="pl-10">
              <SelectValue placeholder="Select your province" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="batanes">Batanes</SelectItem>
              <SelectItem value="cagayan">Cagayan</SelectItem>
              <SelectItem value="isabela">Isabela</SelectItem>
              <SelectItem value="nueva-vizcaya">Nueva Vizcaya</SelectItem>
              <SelectItem value="quirino">Quirino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.userType === "lgu" && (
        <div className="space-y-2">
          <Label htmlFor="city">City/Municipality</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Select
              value={formData.city}
              onValueChange={(value) => setFormData({ ...formData, city: value })}
              disabled={!formData.province}
              required
            >
              <SelectTrigger className="pl-10">
                <SelectValue placeholder="Select your city/municipality" />
              </SelectTrigger>
              <SelectContent>
                {formData.province && region2Locations[formData.province as keyof typeof region2Locations]?.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create password"
              className="pl-10 pr-10"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              className="pl-10 pr-10"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="terms"
          checked={formData.agreeToTerms}
          onCheckedChange={(checked) => setFormData({ ...formData, agreeToTerms: checked as boolean })}
        />
        <Label htmlFor="terms" className="text-sm text-muted-foreground">
          I agree to the platform Terms of Service and Privacy Policy for DOST Region 02&apos;s Smart and Sustainable Communities Academy.
        </Label>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={!formData.agreeToTerms || isLoading}>
        {isLoading ? "Creating Account..." : "Create Account"}
      </Button>
    </form>
  )
}