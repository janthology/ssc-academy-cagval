import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

// Public certificate verification. Intentionally uses the service-role client to
// bypass RLS (certificate rows are otherwise owner/admin-only after migration 004),
// but returns ONLY a minimal, non-sensitive field set: recipient name, course
// title, completion date. Never grade, organization, region, hash, or user type.
//
// Response always includes a `status` the page can switch on:
//   valid      -> certificate exists and is active (includes the safe fields)
//   revoked    -> certificate exists but has been revoked (NO fields returned)
//   not_found  -> no certificate with that id (or malformed id)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("certificates")
      .select(`status, issued_at, course:courses(title), user:users(name)`)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    // Revoked: confirm existence but reveal nothing further.
    if (data.status === "revoked") {
      return NextResponse.json({ status: "revoked" });
    }

    // Anything other than an active certificate is not a valid verification.
    if (data.status !== "active") {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    const course = Array.isArray(data.course) ? data.course[0] : data.course;
    const user = Array.isArray(data.user) ? data.user[0] : data.user;

    return NextResponse.json({
      status: "valid",
      certificate: {
        recipientName: user?.name ?? "Unknown Recipient",
        courseTitle: course?.title ?? "Unknown Course",
        completionDate: data.issued_at ?? null,
      },
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
