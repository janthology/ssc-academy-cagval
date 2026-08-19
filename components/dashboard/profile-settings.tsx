"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
//import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
//import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, User2, Building2, MapPin, Mail, Phone, Camera, Bell, Shield, Download, Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { getUserByEmail } from "@/lib/database/client-queries"
import type { User } from "@/lib/types/database"

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

export function ProfileSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    user_type: "",
    organization: "",
    organization_id: null as string | null,
    position: "",
    province: "",
    city: "",
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true)
      try {
        const { data: { user: authUser } } = await supabaseBrowser.auth.getUser()
        if (!authUser?.email) {
          setMessage({ type: "error", text: "No authenticated user found. Please log in." })
          return
        }
        const userData = await getUserByEmail(authUser.email)
        if (!userData) {
          setMessage({ type: "error", text: "User data not found in database." })
          return
        }
        setUser(userData)
        setFormData({
          name: userData.name || "",
          email: userData.email || "",
          user_type: userData.user_type || "",
          organization: userData.organization || "",
          organization_id: userData.organization_id ?? null,
          position: userData.position || "",
          province: userData.province || "",
          city: userData.city || "",
        })
        setAvatarPreview(userData.avatar || null)
        if (userData.avatar) {
          const { data, error } = await supabaseBrowser.storage
            .from("avatars")
            .createSignedUrl(userData.avatar, 60)
          if (error) {
            setAvatarPreview(userData.avatar)
          } else {
            setAvatarPreview(data.signedUrl)
          }
        }
      } catch (err: any) {
        setMessage({ type: "error", text: "Failed to load profile data." })
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [])

  // Auto-populate organization for LGU users when city is selected
  useEffect(() => {
    if (formData.user_type === "lgu" && formData.city && formData.province) {
      const formattedProvince = formData.province.charAt(0).toUpperCase() + formData.province.slice(1)
      setFormData((prev) => ({
        ...prev,
        organization: `LGU ${formData.city}, ${formattedProvince}`,
        // Derived name still links only on an exact registry match.
        organization_id: null,
      }))
    } else if (formData.user_type !== "lgu") {
      setFormData((prev) => ({
        ...prev,
        organization: prev.organization || ""
      }))
    }
  }, [formData.user_type, formData.city, formData.province])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user?.id) return

    const validTypes = ["image/jpeg", "image/png", "image/gif"]
    if (!validTypes.includes(file.type)) {
      setMessage({ type: "error", text: "Please upload a JPG, PNG, or GIF file." })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "File size must be less than 2MB." })
      return
    }

    setUploadLoading(true)
    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabaseBrowser.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        if (uploadError.message.includes("row-level security policy")) {
          throw new Error("Upload failed due to security policy. Please verify the 'avatars' bucket policy in the Supabase dashboard.")
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabaseBrowser.storage
        .from("avatars")
        .getPublicUrl(fileName)
      const { data, error } = await supabaseBrowser.storage
        .from("avatars")
        .createSignedUrl(fileName, 3600)
      if (error) throw error

      setAvatarPreview(data.signedUrl || publicUrl)
      await supabaseBrowser
        .from('users')
        .update({ avatar: fileName, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      setMessage({ type: "success", text: "Avatar updated successfully." })
    } catch (err: any) {
      setMessage({ type: "error", text: `Failed to upload avatar: ${err.message || 'Unknown error'}` })
    } finally {
      setUploadLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!user?.id) {
      setMessage({ type: "error", text: "Cannot update profile: User ID is missing." })
      return
    }

    // Validate city for LGU users
    if (formData.user_type === "lgu" && !formData.city) {
      setMessage({ type: "error", text: "City is required for LGU users" })
      return
    }

    setIsLoading(true)
    setMessage(null)
    try {
      const updateData: Partial<User> = {
        name: formData.name,
        email: formData.email,
        user_type: formData.user_type as 'individual' | 'lgu' | 'suc' | 'hei' | 'dost' | 'government',
        // Trimmed so the stored free text matches what the picker and the
        // migration backfill both treat as an exact name.
        organization: formData.organization.trim() || undefined,
        organization_id: formData.organization_id ?? null,
        position: formData.position || undefined,
        province: formData.province || undefined,
        city: formData.city || undefined,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabaseBrowser
        .from('users')
        .update(updateData)
        .eq('id', user.id)
      
      if (error) {
        throw new Error(error.message)
      }
      setMessage({ type: "success", text: "Profile updated successfully." })
    } catch (err: any) {
      setMessage({ type: "error", text: `Failed to update profile: ${err.message || 'Unknown error'}` })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        {message && (
          <Alert className={message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <AlertDescription className={message.type === "success" ? "text-green-600" : "text-red-600"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-serif">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account information and preferences</p>
      </div>

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

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User2 className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal details and profile picture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={avatarPreview || user.avatar || "/placeholder.svg"} alt="Profile" />
                  <AvatarFallback className="text-lg">{user.name?.[0] || "U"}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      className="gap-2 bg-transparent"
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                      disabled={uploadLoading}
                    >
                      {uploadLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          Change Photo
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">JPG, PNG or GIF. Max size 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                </div>
              </div>

              <Button onClick={handleUpdate} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Organization Details
              </CardTitle>
              <CardDescription>Manage your organization information and team settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="user_type">Organization Type</Label>
                <Select
                  value={formData.user_type}
                  onValueChange={(value) => handleChange('user_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="organization">Organization Name</Label>
                <OrganizationPicker
                  value={formData.organization}
                  organizationId={formData.organization_id}
                  onChange={({ organization, organization_id }) =>
                    setFormData((prev) => ({ ...prev, organization, organization_id }))
                  }
                  disabled={formData.user_type === "lgu"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Position/Role</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Province in Region 2</Label>
                <Select
                  value={formData.province}
                  onValueChange={(value) => handleChange('province', value)}
                >
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="city">City/Municipality</Label>
                <Select
                  value={formData.city}
                  onValueChange={(value) => handleChange('city', value)}
                  disabled={!formData.province}
                >
                  <SelectTrigger>
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

              <Button onClick={handleUpdate} disabled={isLoading}>
                {isLoading ? "Saving..." : "Update Organization Info"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified about course updates and activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* These switches are NOT wired to any storage. Rather than let them
                  look interactive and silently discard the user's choice, they are
                  disabled and unchecked, and the note below says why. */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Not yet available.</span> Notification preferences
                  can&apos;t be changed yet — these controls are disabled until the setting is built.
                  You still receive in-app notifications (the bell in the header) for module reviews,
                  course assignments and issued certificates; this page just can&apos;t turn them on
                  or off yet.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Course Updates</Label>
                    <p className="text-sm text-muted-foreground">New lessons, assignments, and announcements</p>
                  </div>
                  <Switch disabled aria-label="Course Updates (not yet available)" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Certificate Notifications</Label>
                    <p className="text-sm text-muted-foreground">When certificates are ready for download</p>
                  </div>
                  <Switch disabled aria-label="Certificate Notifications (not yet available)" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Team Activity</Label>
                    <p className="text-sm text-muted-foreground">Updates from your organization team</p>
                  </div>
                  <Switch disabled aria-label="Team Activity (not yet available)" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Event Reminders</Label>
                    <p className="text-sm text-muted-foreground">Webinars, workshops, and conferences</p>
                  </div>
                  <Switch disabled aria-label="Event Reminders (not yet available)" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Marketing Communications</Label>
                    <p className="text-sm text-muted-foreground">New courses and platform updates</p>
                  </div>
                  <Switch disabled aria-label="Marketing Communications (not yet available)" />
                </div>

                {/* Grouped inside the same dimmed block so its disabled state reads
                    as belonging to the controls above, not as a broken button. */}
                <Button disabled>Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Privacy & Security
              </CardTitle>
              <CardDescription>Manage your privacy settings and account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Same reasoning as the notifications tab: not wired to storage,
                  so disabled and unchecked rather than falsely interactive. */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Not yet available.</span> Privacy controls
                  can&apos;t be changed yet. Note that certificates you earn remain publicly
                  verifiable by their verification link — that is how employers confirm a
                  credential, and it is not currently optional.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Show your profile to other learners</p>
                  </div>
                  <Switch disabled aria-label="Profile Visibility (not yet available)" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Progress Sharing</Label>
                    <p className="text-sm text-muted-foreground">Allow team members to see your progress</p>
                  </div>
                  <Switch disabled aria-label="Progress Sharing (not yet available)" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Certificate Verification</Label>
                    <p className="text-sm text-muted-foreground">Allow public verification of your certificates</p>
                  </div>
                  <Switch disabled aria-label="Certificate Verification (not yet available)" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Account Security</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start bg-transparent" disabled>
                    Change Password
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" disabled>
                    Enable Two-Factor Authentication
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Data Management</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" disabled>
                    <Download className="w-4 h-4" />
                    Download My Data
                  </Button>
                  <Button variant="destructive" className="w-full justify-start" disabled>
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}