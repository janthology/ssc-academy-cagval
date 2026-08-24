import { UUID_REGEX } from "@/lib/certificates/constants"
import { verifyCertificateRef } from "@/lib/certificates/verify"
import { NextResponse } from "next/server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const decoded = decodeURIComponent(id || "").trim()

  // Deep links are UUID-based; reject empty / obviously invalid path segments early.
  if (!decoded) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  // Allow UUID or certificate_number in the path (encoded).
  if (!UUID_REGEX.test(decoded) && decoded.length < 8) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  try {
    return await verifyCertificateRef(decoded)
  } catch (err) {
    console.error("certificate verify fatal:", err instanceof Error ? err.message : err)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}
