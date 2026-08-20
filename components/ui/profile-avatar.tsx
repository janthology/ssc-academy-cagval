"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { cn } from "@/lib/utils"

/**
 * Resolves a users.avatar storage path (or absolute URL) to a displayable image.
 * Falls back to initials when the path is missing or unreadable.
 */
export function ProfileAvatar({
  avatar,
  name,
  className,
}: {
  avatar?: string | null
  name?: string | null
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!avatar) {
        setUrl(null)
        return
      }

      // Already a usable URL/path — skip storage signing.
      if (/^https?:\/\//i.test(avatar) || avatar.startsWith("/")) {
        if (!cancelled) setUrl(avatar)
        return
      }

      const { data, error } = await supabaseBrowser.storage
        .from("avatars")
        .createSignedUrl(avatar, 3600)

      if (cancelled) return

      if (!error && data?.signedUrl) {
        setUrl(data.signedUrl)
        return
      }

      // Public-bucket fallback when signed URLs are blocked by storage policy.
      const { data: pub } = supabaseBrowser.storage.from("avatars").getPublicUrl(avatar)
      setUrl(pub?.publicUrl || null)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [avatar])

  const initials = (name || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Avatar className={cn("h-10 w-10", className)} key={url ?? "no-avatar"}>
      {url ? (
        <AvatarImage src={url} alt={name || "User"} className="object-cover" />
      ) : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
