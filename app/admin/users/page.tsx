import { AdminHeader } from "@/components/admin/admin-header"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { UserManagement } from "@/components/admin/user-management"

export default function AdminUsersPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <UserManagement />
        </main>
      </div>
    </div>
  )
}
