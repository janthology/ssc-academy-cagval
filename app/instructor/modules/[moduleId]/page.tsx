import { InstructorHeader } from "@/components/instructor/instructor-header";
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar";
import { InstructorGuard } from "@/components/instructor/instructor-guard";
import { ModuleEditor } from "@/components/instructor/module-editor";

// Edit a standalone/orphan module. Course context is resolved from the module's
// own course_id inside ModuleEditor, so courseId is passed as null here.
export default async function StandaloneModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  return (
    <div className="min-h-screen bg-background">
      <InstructorHeader />
      <div className="flex">
        <InstructorSidebar />
        <main className="flex-1 p-6">
          <InstructorGuard>
            <ModuleEditor courseId={null} moduleId={moduleId} />
          </InstructorGuard>
        </main>
      </div>
    </div>
  );
}
