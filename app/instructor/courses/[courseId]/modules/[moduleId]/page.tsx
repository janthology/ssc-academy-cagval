import { InstructorHeader } from "@/components/instructor/instructor-header";
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar";
import { InstructorGuard } from "@/components/instructor/instructor-guard";
import { ModuleEditor } from "@/components/instructor/module-editor";

export default async function InstructorModulePage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = await params;

  return (
    <div className="min-h-screen bg-background">
      <InstructorHeader />
      <div className="flex">
        <InstructorSidebar />
        <main className="flex-1 p-6">
          <InstructorGuard>
            <ModuleEditor courseId={courseId} moduleId={moduleId} />
          </InstructorGuard>
        </main>
      </div>
    </div>
  );
}
