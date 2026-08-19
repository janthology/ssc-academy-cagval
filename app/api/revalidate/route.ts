import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// On-demand revalidation for the public ISR pages (course catalog/detail, and
// the events list), so a newly created course, a newly published module, or an
// edited event appears immediately instead of waiting out the 300s window.
// Restricted to those paths — it only invalidates cache for public pages,
// changes no data, and cannot touch anything else.
const ALLOWED = /^\/(courses|events)(\/[A-Za-z0-9-]+)?$/

export async function POST(request: Request) {
  let path: string | undefined
  try {
    ({ path } = await request.json())
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  if (!path || !ALLOWED.test(path)) {
    return NextResponse.json({ error: "path not allowed" }, { status: 400 })
  }

  revalidatePath(path)
  return NextResponse.json({ revalidated: true, path })
}
