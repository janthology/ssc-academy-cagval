"use client";

import { useState, useEffect, useRef } from "react";
import { CourseCard } from "./course-card";
import { CourseCardsSkeleton } from "@/components/ui/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import type { Course } from "@/lib/types/database";

interface CourseGridProps {
  filters: {
    level?: string;
    category?: string;
    target_audience?: string[];
    duration?: { min?: number; max?: number };
  };
  search?: string;
  // Server-rendered initial list (unfiltered active catalog). Seeds the grid so
  // the first paint needs no client fetch.
  initialCourses?: Course[];
}

export function CourseGrid({ filters, search, initialCourses = [] }: CourseGridProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    // Skip ONLY the first mount when nothing is filtered/searched — the
    // server-provided initialCourses already covers that case. Every later
    // filter/search change still goes through the debounced fetch below.
    const noQuery =
      !filters.level &&
      !filters.category &&
      !(filters.target_audience?.length) &&
      !filters.duration?.min &&
      !filters.duration?.max &&
      !search;
    if (firstRun.current) {
      firstRun.current = false;
      // Only trust the server data when it's actually present. If the server
      // render produced an empty list (e.g. a build-time fetch failure), fall
      // through and fetch on the client so the catalog isn't stuck empty.
      if (noQuery && initialCourses.length > 0) return;
    }

    // Debounce so typing fires one request after a pause, not one per keystroke.
    // The AbortController cancels any in-flight request when a newer change
    // supersedes it, so a stale response can never overwrite a newer one.
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = new URL("/api/courses", window.location.origin);
        if (filters.level) url.searchParams.append("level", filters.level);
        if (filters.category) url.searchParams.append("category", filters.category);
        if (filters.target_audience?.length)
          url.searchParams.append("target_audience", JSON.stringify(filters.target_audience));
        if (filters.duration?.min) url.searchParams.append("durationMin", filters.duration.min.toString());
        if (filters.duration?.max) url.searchParams.append("durationMax", filters.duration.max?.toString() || "");
        if (search) url.searchParams.append("search", search);

        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        setCourses(data.courses || []);
      } catch (err: any) {
        if (err?.name === "AbortError") return; // superseded by a newer request
        setError("Failed to load courses. Please try again.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);   // cancel a pending (not-yet-fired) request
      controller.abort();    // cancel an in-flight one
    };
  }, [filters, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Available Courses</h2>
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <p className="text-muted-foreground">{courses.length} courses found</p>
        )}
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {isLoading ? (
        <CourseCardsSkeleton />
      ) : !error && courses.length === 0 ? (
        <p className="text-muted-foreground">No courses found.</p>
      ) : !error ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
