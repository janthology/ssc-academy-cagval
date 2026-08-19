import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const category = searchParams.get("category");
  const target_audience = searchParams.get("target_audience");
  const durationMin = searchParams.get("durationMin") ? parseInt(searchParams.get("durationMin")!) : undefined;
  const durationMax = searchParams.get("durationMax") ? parseInt(searchParams.get("durationMax")!) : undefined;
  const search = searchParams.get("search");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );

  // Only the columns the course card renders, plus modules(id) purely for the
  // "N modules" count (via .length). Previously this pulled every module's
  // title+description+more — ~3x the payload for data the catalog never shows.
  let query = supabase
    .from("courses")
    .select(`
      id,
      title,
      description,
      level,
      category,
      duration,
      thumbnail,
      rating,
      enrollment_count,
      target_audience,
      instructor,
      modules!course_id ( id )
    `)
    .eq("is_active", true);

  if (level) query = query.eq("level", level);
  if (category) query = query.eq("category", category);
  if (target_audience) {
    // target_audience arrives as a JSON-encoded string array. Guard the parse so
    // malformed input is a clean 400, not an unhandled 500. Also require an
    // actual array of strings.
    let audienceArray: unknown;
    try {
      audienceArray = JSON.parse(target_audience);
    } catch {
      return NextResponse.json({ error: "Invalid target_audience parameter" }, { status: 400 });
    }
    if (!Array.isArray(audienceArray) || !audienceArray.every((a) => typeof a === "string")) {
      return NextResponse.json({ error: "Invalid target_audience parameter" }, { status: 400 });
    }
    query = query.contains("target_audience", audienceArray as string[]);
  }
  if (durationMin !== undefined) query = query.gte("duration", durationMin * 60);
  if (durationMax !== undefined) query = query.lte("duration", durationMax * 60);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }

  const coursesWithModules = data.map((course) => {
    const modules = Array.isArray(course.modules) ? course.modules : [];
    return {
      ...course,
      modules,
    };
  });

  return NextResponse.json({ courses: coursesWithModules });
}