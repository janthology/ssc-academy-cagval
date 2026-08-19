import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { requireAuth } from "@/lib/auth/api-auth";
import type { Certificate } from "@/lib/types/database";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";

// Regex for UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Await params to resolve the dynamic route parameter
  const resolvedParams = await params;
  const { id } = resolvedParams ?? { id: null };

  try {
    // Log request details

    // Validate UUID format
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid certificate ID format" }, { status: 400 });
    }

    // Require authentication; only the certificate owner or an admin may download.
    const { error: authError, user, profile } = await requireAuth();
    if (authError) {
      return authError;
    }

    // Data fetched with the service-role client; this route is the trust boundary
    // and enforces ownership explicitly below (not via RLS), so a non-owner gets
    // a deterministic 403 rather than a 404 once certificate RLS is tightened.
    const supabase = supabaseAdmin();

    // Fetch certificate data
    const { data: certData, error: certError } = await supabase
      .from("certificates")
      .select(`
        id,
        user_id,
        course_id,
        certificate_number,
        issued_at,
        verification_hash,
        status,
        course:courses(id, title, instructor, skills),
        user:users(id, name, organization, user_type, region)
      `)
      .eq("id", id)
      .single();

    if (certError || !certData) {
      return NextResponse.json({ error: "Certificate not found", details: certError?.message }, { status: 404 });
    }

    // Ownership check: only the owner or an admin may download this certificate.
    if (certData.user_id !== user!.id && !profile!.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Enrollment (optional)
    const { data: enrollmentData } = await supabase
      .from("enrollments")
      .select("course_id, user_id, grade")
      .eq("course_id", certData.course_id)
      .eq("user_id", certData.user_id)
      .single();

    const certificate: Certificate = {
      id: certData.id,
      user_id: certData.user_id,
      course_id: certData.course_id,
      certificate_number: certData.certificate_number,
      issued_at: certData.issued_at,
      verification_hash: certData.verification_hash,
      status: certData.status,
      course: Array.isArray(certData.course) ? certData.course[0] : certData.course,
      user: Array.isArray(certData.user) ? certData.user[0] : certData.user,
      enrollment: enrollmentData ? (Array.isArray(enrollmentData) ? enrollmentData[0] : enrollmentData) : null,
    };

    // Create PDF
    const doc = new PDFDocument({
      size: [792, 612], // landscape
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    });

    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));

    try {
      // --- Color Palette ---
      const BLUE_DARK = "#0B3A64";
      const BLUE_MEDIUM = "#1E538A";
      const BLUE_LIGHT = "#3C95F9";
      const LIGHT_TEXT = "#666666";
      const DARK_TEXT = "#222222";

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const leftMargin = 60;
      const rightMargin = pageWidth - 60;

      // --- Background ---
      const backgroundPath = path.join(process.cwd(), "public", "certbackground.png");
      if (fs.existsSync(backgroundPath)) {
        doc.image(backgroundPath, 0, 0, { width: pageWidth, height: pageHeight });
      } else {
        doc.rect(0, 0, pageWidth, pageHeight).fill("#FFFFFF"); // Fallback to white if image is missing
      }

      // --- Ribbon dimensions (declared early so they're available everywhere) ---
      const ribbonWidth = 200;
      const ribbonX = pageWidth - ribbonWidth;
      const ribbonY = 0;

      // --- Ribbon: prefer image; fallback to gradient if PNG missing ---
      const ribbonImagePath = path.join(process.cwd(), "public", "certribbon.png");
      if (fs.existsSync(ribbonImagePath)) {
        doc.image(ribbonImagePath, ribbonX, ribbonY, { width: ribbonWidth });
      } else {
        const gradient = doc.linearGradient(ribbonX, 0, pageWidth, pageHeight);
        gradient.stop(0, BLUE_MEDIUM).stop(1, BLUE_LIGHT);
        doc.rect(ribbonX, ribbonY, ribbonWidth, pageHeight).fill(gradient);
      }

      // --- Logo & Org Name ---
      const logoPath = path.join(process.cwd(), "public", "dostcertlogo.png");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, leftMargin, 40, { width: 80 });
      }
      doc.fillColor(BLUE_DARK).font("Helvetica-Bold").fontSize(18);
      doc.text("DEPARTMENT OF SCIENCE AND TECHNOLOGY", leftMargin + 90, 50);
      doc.fontSize(14).text("REGIONAL OFFICE 02", leftMargin + 90, 75);
      doc.font("Helvetica").fontSize(16).fillColor(LIGHT_TEXT);
      doc.text("SMART AND SUSTAINABLE COMMUNITIES ACADEMY", leftMargin + 90, 98);

      // --- Date (top-left under org) ---
      const issuedDate = certificate.issued_at ? new Date(certificate.issued_at) : new Date();
      const formattedDate = issuedDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      doc.font("Helvetica").fontSize(12).fillColor(LIGHT_TEXT);
      doc.text(`Issued: ${formattedDate}`, leftMargin, 160);

      // --- Recipient Name (center focus, serif font) ---
      const contentY = 220;
      doc.font("Times-Bold").fontSize(36).fillColor(BLUE_DARK);
      doc.text(certificate.user?.name || "Unknown Recipient", leftMargin, contentY, {
        width: pageWidth - ribbonWidth - 120,
        align: "left",
      });

      // --- Completion Line ---
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(14).fillColor(LIGHT_TEXT);
      doc.text("has successfully completed", leftMargin, doc.y);

      // --- Course Title ---
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(20).fillColor(BLUE_MEDIUM);
      doc.text(certificate.course?.title || "Unknown Course", leftMargin, doc.y, {
        width: pageWidth - ribbonWidth - 120,
        align: "left",
      });

      // --- Subtitle line ---
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(12).fillColor(LIGHT_TEXT);
      doc.text("An online course authorized by DOST - Region 02 and offered through the", leftMargin, doc.y);
      doc.font("Helvetica-Bold");
      doc.text("Smart and Sustainable Communities Program", leftMargin, doc.y);

      // --- Grade & Skills (if any) ---
      if (certificate.enrollment?.grade) {
        doc.moveDown(0.7);
        doc.font("Helvetica").fontSize(12).fillColor(DARK_TEXT);
        doc.text(`Grade: ${certificate.enrollment.grade}%`, leftMargin, doc.y);
      }
      if (certificate.course?.skills?.length) {
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(12).fillColor(LIGHT_TEXT);
        doc.text("Skills: " + certificate.course.skills.join(", "), leftMargin, doc.y, {
          width: pageWidth - ribbonWidth - 120,
        });
      }

      // --- Instructor signature ---
      const signatureY = pageHeight - 140;
      doc.strokeColor(LIGHT_TEXT).lineWidth(0.5).moveTo(leftMargin, signatureY).lineTo(leftMargin + 250, signatureY).stroke();
      doc.font("Times-Italic").fontSize(16).fillColor(DARK_TEXT).text("Dr. Virginia G. Bilgera", leftMargin, signatureY - 20);
      doc.font("Helvetica").fontSize(10).fillColor(LIGHT_TEXT).text("Regional Director", leftMargin, signatureY + 10);
      doc.text("DOST - Region 02", leftMargin, signatureY + 24);

      // --- QR Code ---
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sscacademy.dost02onedata.com";
      const verificationUrl = `${appUrl}/verify/${certificate.id}`;
      let qrCodeBuffer: Buffer;
      try {
        qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
          errorCorrectionLevel: "M",
          width: 80,
        });
      } catch (err) {
        throw new Error(`Failed to generate QR code: ${String(err)}`);
      }

      const qrCodeX = ribbonX - 100; // Left of ribbon
      const qrCodeY = signatureY - 22; // Inline with signature text
      doc.image(qrCodeBuffer, qrCodeX, qrCodeY, { width: 80 });
      doc.font("Helvetica").fontSize(8).fillColor(DARK_TEXT).text(
        "Scan to Verify",
        qrCodeX,
        qrCodeY + 85,
        { width: 80, align: "center" }
      );

      // --- Verification text ---
      const verifyY = pageHeight - 120; // Original position
      doc.font("Helvetica-Oblique").fontSize(10).fillColor("#FFFFFF").text(
        `Certificate ID: ${certificate.certificate_number}`,
        ribbonX + (ribbonWidth - 140) / 2,
        verifyY,
        { width: 140, align: "center" }
      );

    } catch (err) {
      throw new Error(`Failed to set PDF content: ${String(err)}`);
    }

    doc.end();
    await new Promise<void>((resolve) => doc.on("end", resolve));
    const pdfBuffer = Buffer.concat(buffers);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=certificate-${certificate.certificate_number}.pdf`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to generate PDF", details: err.message }, { status: 500 });
  }
}