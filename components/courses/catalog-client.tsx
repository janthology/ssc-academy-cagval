"use client"

import { useState, useRef } from "react"
import { Header } from "@/components/ui/header"
import { CourseGrid } from "@/components/courses/course-grid"
import CourseFilters from "@/components/courses/course-filters"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Course } from "@/lib/types/database"

// Client interactivity for the catalog: search input + filters. The initial,
// unfiltered course list is server-rendered (see app/courses/page.tsx) and passed
// in as `initialCourses`, so the first paint has data with no client round-trip.
// CourseGrid seeds from it and only fetches when a filter/search is applied.
export function CatalogClient({ initialCourses }: { initialCourses: Course[] }) {
  const [filters, setFilters] = useState<{
    level?: string
    category?: string
    target_audience?: string[]
    duration?: { min?: number; max?: number }
  }>({
    level: "",
    category: "",
    target_audience: [],
    duration: { min: undefined, max: undefined },
  })
  const [search, setSearch] = useState("")
  const courseFiltersRef = useRef<{ resetFilters: () => void }>(null)

  const handleFilterChange = (newFilters: {
    level?: string
    category?: string
    target_audience?: string[]
    duration?: { min?: number; max?: number }
  }) => {
    setFilters(newFilters)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  const getDurationLabel = (min?: number, max?: number) => {
    if (min === 1 && max === 3) return "1-3 hours"
    if (min === 4 && max === 6) return "4-6 hours"
    if (min === 7 && max === 10) return "7-10 hours"
    if (min === 10 && max === undefined) return "10+ hours"
    return ""
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary">Region 2 - Cagayan Valley</Badge>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4 font-serif">Smart and Sustainable Communities Courses</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Comprehensive courses designed for government agencies, universities, and individuals to master smart
            city technologies and implementations.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses, modules, or topics..."
                className="pl-10 h-12"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setFilters({ level: "", category: "", target_audience: [], duration: { min: undefined, max: undefined } });
                setSearch("");
                if (courseFiltersRef.current) {
                  courseFiltersRef.current.resetFilters();
                }
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Filter Badges */}
        {(filters.level || filters.category || (filters.target_audience?.length || 0) > 0 || (filters.duration?.min && filters.duration?.max !== undefined) || (filters.duration?.min && filters.duration?.max === undefined)) && (
          <div className="flex flex-wrap gap-2 mb-6">
            {filters.level && <Badge variant="secondary" className="capitalize">{filters.level}</Badge>}
            {filters.category && <Badge variant="secondary">{filters.category}</Badge>}
            {filters.target_audience?.map((audience) => (
              <Badge key={audience} variant="secondary" className="capitalize">
                {audience === "lgu" ? "LGU" : audience === "suc" ? "SUC" : audience === "hei" ? "HEI" : audience === "dost" ? "DOST" : audience === "individual" ? "Individual" : audience.charAt(0).toUpperCase() + audience.slice(1)}
              </Badge>
            ))}
            {(filters.duration?.min || filters.duration?.max) && (
              <Badge variant="secondary">{getDurationLabel(filters.duration.min, filters.duration.max)}</Badge>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <CourseFilters onFilterChange={handleFilterChange} ref={courseFiltersRef} />
          </div>
          <div className="lg:col-span-3">
            <CourseGrid filters={filters} search={search} initialCourses={initialCourses} />
          </div>
        </div>
      </div>
    </div>
  )
}
