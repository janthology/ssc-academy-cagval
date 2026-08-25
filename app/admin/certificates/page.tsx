import { AdminHeader } from "@/components/admin/admin-header"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { CertificateManagement } from "@/components/admin/certificate-management"

export default function AdminCertificatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <CertificateManagement />
        </main>
      </div>
    </div>
  )
}
