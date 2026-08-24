import { NextResponse } from "next/server"
import { verifyCertificateRef } from "@/lib/certificates/verify"

// Guest-friendly lookup: /api/certificates/verify?ref=<uuid-or-certificate-number>
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref")?.trim() ?? ""

  if (!ref) {
    return NextResponse.json(
      { status: "error", message: "Missing ref query parameter" },
      { status: 400 }
    )
  }

  try {
    return await verifyCertificateRef(ref)
  } catch (err) {
    console.error("certificate verify lookup fatal:", err instanceof Error ? err.message : err)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}
