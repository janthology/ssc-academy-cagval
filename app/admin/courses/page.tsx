import { AdminHeader } from "@/components/admin/admin-header"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { CourseManagement } from "@/components/admin/course-management"

export default function AdminCoursesPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <CourseManagement />
        </main>
      </div>
    </div>
  )
}
