import { Header } from "@/components/ui/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin } from "lucide-react"
import { supabasePublic } from "@/lib/supabase/public-client"
import { EVENT_TYPE_LABEL, eventDate, eventTime } from "@/lib/events/format"
import type { Event } from "@/lib/types/database"

// Public events list, server-rendered and cached (ISR) — same treatment as the
// course catalog. The data is anon-only and identical for everyone. Admin
// create/edit/delete calls revalidatePath('/events') so changes appear at once
// instead of waiting out the window. The cookieless supabasePublic client is
// what keeps this route static (touching cookies() would make it dynamic).
export const revalidate = 300

async function getUpcomingEvents(): Promise<Event[]> {
  const { data } = await supabasePublic
    .from("events")
    .select("id,title,description,event_type,starts_at,ends_at,location,is_published,created_at,updated_at")
    .eq("is_published", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
  return (data ?? []) as Event[]
}

export default async function EventsPage() {
  const events = await getUpcomingEvents()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-bold text-foreground">Upcoming Events</h1>
          <p className="text-muted-foreground">Webinars, workshops, and conferences from the Academy</p>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No upcoming events scheduled.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((ev) => (
              <Card key={ev.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">{ev.title}</CardTitle>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {EVENT_TYPE_LABEL[ev.event_type]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {eventDate(ev.starts_at)} at {eventTime(ev.starts_at, ev.ends_at)}
                  </p>
                  {ev.location && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {/^https?:\/\//.test(ev.location) ? (
                        <a href={ev.location} target="_blank" rel="noopener noreferrer" className="underline">
                          Join link
                        </a>
                      ) : (
                        ev.location
                      )}
                    </p>
                  )}
                  {ev.description && <p className="text-sm">{ev.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
