import { notFound } from "next/navigation"
import { LearningPathDetailClient } from "@/components/learning-paths/learning-path-detail-client"
import { fetchPublicLearningPath } from "@/lib/learning-paths/public-paths"

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

export default async function LearningPathDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const path = await fetchPublicLearningPath(id)
  if (!path) notFound()
  return <LearningPathDetailClient path={path} />
}
