import { InstructorHeader } from "@/components/instructor/instructor-header";
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar";
import { InstructorGuard } from "@/components/instructor/instructor-guard";
import { InstructorCourseList } from "@/components/instructor/instructor-course-list";

export default function InstructorPage() {
  return (
    <div className="min-h-screen bg-background">
      <InstructorHeader />
      <div className="flex">
        <InstructorSidebar />
        <main className="flex-1 p-6">
          <InstructorGuard>
            <InstructorCourseList />
          </InstructorGuard>
        </main>
      </div>
    </div>
  );
}
