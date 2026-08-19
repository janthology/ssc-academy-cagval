import { InstructorHeader } from "@/components/instructor/instructor-header";
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar";
import { InstructorGuard } from "@/components/instructor/instructor-guard";
import { ModuleEditor } from "@/components/instructor/module-editor";

// Standalone (orphan) module creation — no course assigned yet. Assignment to a
// course is an admin action later (see /admin/assign).
export default function NewStandaloneModulePage() {
  return (
    <div className="min-h-screen bg-background">
      <InstructorHeader />
      <div className="flex">
        <InstructorSidebar />
        <main className="flex-1 p-6">
          <InstructorGuard>
            <ModuleEditor courseId={null} moduleId="new" />
          </InstructorGuard>
        </main>
      </div>
    </div>
  );
}
