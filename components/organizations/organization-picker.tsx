"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Building2, Check } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

type Suggestion = { id: string; name: string; type: string; score: number }

/**
 * Organization input backed by the real organizations registry.
 *
 * Linking rules (same principle as course prerequisite titles):
 *  - EXACT (case-insensitive, trimmed) name match  -> links automatically, authoritative
 *  - near match                                    -> "Did you mean …?" suggestion ONLY
 *  - no match                                      -> free text, organization_id stays null
 *
 * Never blocks submission: an unlisted organization is still typed and saved
 * to users.organization. New organizations are created by admins only.
 *
 * Works for anonymous sessions (the registration form runs pre-signup):
 * organizations_public_read covers the exact-match lookup and
 * suggest_organizations() is granted to anon (both in migration 015).
 */
export function OrganizationPicker({
  value,
  organizationId,
  onChange,
  disabled = false,
  id = "organization",
  placeholder = "Enter your organization name",
  required = false,
}: {
  value: string
  organizationId: string | null
  onChange: (next: { organization: string; organization_id: string | null }) => void
  disabled?: boolean
  id?: string
  placeholder?: string
  required?: boolean
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [linkedName, setLinkedName] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve the typed text against the registry: an exact match links, near
  // matches become suggestions. Debounced like the course-title lookup (300ms).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const input = value.trim()
    if (input.length < 2) {
      setSuggestions([])
      setLinkedName(null)
      return
    }
    debounce.current = setTimeout(async () => {
      // ilike with no wildcards = case-insensitive exact match, on the TRIMMED
      // input (`input` is value.trim() above) so this agrees with the
      // migration's backfill rule: lower(trim(a)) = lower(trim(b)). The typed
      // value itself is left untrimmed while typing (trimming per keystroke
      // would eat spaces mid-word); it is trimmed at save time instead.
      const { data: exact } = await supabaseBrowser
        .from("organizations")
        .select("id, name")
        .ilike("name", input)
        .limit(1)

      if (exact && exact.length > 0) {
        setSuggestions([])
        setLinkedName(exact[0].name)
        if (organizationId !== exact[0].id) {
          onChange({ organization: exact[0].name, organization_id: exact[0].id })
        }
        return
      }

      setLinkedName(null)
      if (organizationId !== null) onChange({ organization: input, organization_id: null })

      const { data } = await supabaseBrowser.rpc("suggest_organizations", { p_input: input })
      setSuggestions((data ?? []) as Suggestion[])
    }, 300)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const pick = (s: Suggestion) => {
    setSuggestions([])
    setLinkedName(s.name)
    onChange({ organization: s.name, organization_id: s.id })
  }

  return (
    <div className="space-y-2">
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange({ organization: e.target.value, organization_id: null })}
        disabled={disabled}
        required={required}
      />

      {linkedName && (
        <p className="flex items-center gap-1 text-xs text-green-600">
          <Check className="h-3 w-3" />
          Linked to <span className="font-medium">{linkedName}</span> in the organization registry
        </p>
      )}

      {!linkedName && suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Did you mean:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.id} type="button" onClick={() => pick(s)}>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                  <Building2 className="mr-1 h-3 w-3" />
                  {s.name}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {!linkedName && !disabled && value.trim().length >= 2 && suggestions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Not in the registry yet — saved as free text. An admin can add it later.
        </p>
      )}
    </div>
  )
}
