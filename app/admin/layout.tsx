import { AdminStatsProvider } from "@/components/admin/admin-stats-provider"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Shared count fetch for sidebar badges + dashboard — loads once per admin
  // session and persists across /admin/* navigations via the App Router layout.
  return <AdminStatsProvider>{children}</AdminStatsProvider>
}
