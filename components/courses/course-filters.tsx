"use client"

import { useState, forwardRef } from "react"
import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

interface CourseFiltersProps {
  onFilterChange: (filters: {
    level?: string
    category?: string
    target_audience?: string[]
    duration?: { min?: number; max?: number }
  }) => void
}

const CourseFilters = forwardRef(function CourseFilters(
  { onFilterChange }: CourseFiltersProps,
  ref: React.ForwardedRef<{ resetFilters: () => void }>
) {
  const [filters, setFilters] = useState({
    level: "",
    category: "",
    target_audience: [] as string[],
    duration: { min: undefined, max: undefined } as { min?: number; max?: number },
  })

  const handleCheckboxChange = (field: keyof typeof filters, value: string | { min?: number; max?: number }, checked: boolean) => {
    setFilters((prev) => {
      if (field === "target_audience" && typeof value === "string") {
        const newTargetAudience = checked
          ? [...prev.target_audience, value.toLowerCase()]
          : prev.target_audience.filter((item) => item !== value.toLowerCase());
        return { ...prev, [field]: newTargetAudience };
      } else if (field === "duration" && typeof value === "object" && value) {
        const range = value as { min?: number; max?: number };
        return { ...prev, [field]: checked ? range : { min: undefined, max: undefined } };
      } else {
        return { ...prev, [field]: checked ? value : "" };
      }
    });
  }

  const handleApplyFilters = () => {
    onFilterChange(filters);
  }

  const handleResetFilters = () => {
    setFilters({
      level: "",
      category: "",
      target_audience: [],
      duration: { min: undefined, max: undefined },
    });
    onFilterChange({
      level: "",
      category: "",
      target_audience: [],
      duration: { min: undefined, max: undefined },
    });
  }

  React.useImperativeHandle(ref, () => ({
    resetFilters: handleResetFilters,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filter Courses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-3">Level</h4>
          <div className="space-y-2">
            {["beginner", "intermediate", "advanced"].map((level) => (
              <div key={level} className="flex items-center space-x-2">
                <Checkbox
                  id={`level-${level}`}
                  checked={filters.level === level}
                  onCheckedChange={(checked) => handleCheckboxChange("level", level, !!checked)}
                />
                <Label htmlFor={`level-${level}`} className="text-sm capitalize">
                  {level}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-3">Category</h4>
          <div className="space-y-2">
            {["Technology", "Analytics", "Transportation", "Governance", "Energy", "Environment"].map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category}`}
                  checked={filters.category === category}
                  onCheckedChange={(checked) => handleCheckboxChange("category", category, !!checked)}
                />
                <Label htmlFor={`category-${category}`} className="text-sm">
                  {category}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-3">Target Audience</h4>
          <div className="space-y-2">
            {["lgu", "suc", "hei", "dost", "government", "individual"].map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`audience-${type}`}
                  checked={filters.target_audience.includes(type)}
                  onCheckedChange={(checked) => handleCheckboxChange("target_audience", type, !!checked)}
                />
                <Label htmlFor={`audience-${type}`} className="text-sm capitalize">
                  {type === "lgu" ? "LGU" : type === "suc" ? "SUC" : type === "hei" ? "HEI" : type === "dost" ? "DOST" : type === "individual" ? "Individual" : type.charAt(0).toUpperCase() + type.slice(1)}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-3">Duration</h4>
          <div className="space-y-2">
            {[
              { label: "1-3 hours", min: 1, max: 3 },
              { label: "4-6 hours", min: 4, max: 6 },
              { label: "7-10 hours", min: 7, max: 10 },
              { label: "10+ hours", min: 10, max: undefined },
            ].map(({ label, min, max }) => (
              <div key={label} className="flex items-center space-x-2">
                <Checkbox
                  id={`duration-${label}`}
                  checked={filters.duration.min === min && filters.duration.max === max}
                  onCheckedChange={(checked) => handleCheckboxChange("duration", { min, max }, !!checked)}
                />
                <Label htmlFor={`duration-${label}`} className="text-sm">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleApplyFilters} className="w-full">Apply Filters</Button>
      </CardContent>
    </Card>
  )
})

export default CourseFilters