import { supabaseServer } from '@/lib/supabase/server-client'
import type { User, Enrollment, Certificate } from '@/lib/types/database'

// NOTE: the app's live getUserByEmail comes from lib/database/client-queries.ts
// (browser client), not this module. The server-side one below is separate.

// User queries
export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single()
  if (error) {
    console.error('Error fetching user by email:', error)
    return null
  }
  return data
}

export async function getAllUsers(): Promise<User[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('users').select('*')
  if (error) {
    console.error('Error fetching users:', error)
    return []
  }
  return data || []
}

export async function getUsersByType(userType: string): Promise<User[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('users').select('*').eq('user_type', userType)
  if (error) {
    console.error('Error fetching users by type:', error)
    return []
  }
  return data || []
}

// Enrollment queries
export async function getEnrollmentsByUserId(userId: string): Promise<Enrollment[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('enrollments').select('*').eq('user_id', userId)
  if (error) {
    console.error('Error fetching enrollments:', error)
    return []
  }
  return data || []
}

export async function getEnrollmentsByCourseId(courseId: string): Promise<Enrollment[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('enrollments').select('*').eq('course_id', courseId)
  if (error) {
    console.error('Error fetching enrollments by course:', error)
    return []
  }
  return data || []
}

export async function getEnrollment(userId: string, courseId: string): Promise<Enrollment | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('enrollments').select('*').eq('user_id', userId).eq('course_id', courseId).single()
  if (error) {
    console.error('Error fetching enrollment:', error)
    return null
  }
  return data
}

// Certificate queries
export async function getCertificatesByUserId(userId: string): Promise<Certificate[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('certificates').select('*').eq('user_id', userId)
  if (error) {
    console.error('Error fetching certificates:', error)
    return []
  }
  return data || []
}

// Analytics queries
export async function getEnrollmentStats() {
  const supabase = await supabaseServer()
  const { data: enrollments, error } = await supabase.from('enrollments').select('status')
  if (error) {
    console.error('Error fetching enrollment stats:', error)
    return { total: 0, completed: 0, active: 0, completionRate: 0 }
  }
  const totalEnrollments = enrollments.length
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed').length
  const activeEnrollments = enrollments.filter((e) => e.status === 'active').length
  return {
    total: totalEnrollments,
    completed: completedEnrollments,
    active: activeEnrollments,
    completionRate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
  }
}

export async function getUserStats() {
  const supabase = await supabaseServer()
  const { data: users, error } = await supabase.from('users').select('user_type')
  if (error) {
    console.error('Error fetching user stats:', error)
    return { total: 0, byType: {} }
  }
  const totalUsers = users.length
  const usersByType = users.reduce((acc, user) => {
    acc[user.user_type] = (acc[user.user_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  return { total: totalUsers, byType: usersByType }
}

export async function getCourseStats() {
  const supabase = await supabaseServer()
  const { data: courses, error } = await supabase.from('courses').select('is_active, enrollment_count')
  if (error) {
    console.error('Error fetching course stats:', error)
    return { total: 0, active: 0, totalEnrollments: 0 }
  }
  const totalCourses = courses.length
  const activeCourses = courses.filter((c) => c.is_active).length
  const totalEnrollments = courses.reduce((sum, course) => sum + (course.enrollment_count || 0), 0)
  return { total: totalCourses, active: activeCourses, totalEnrollments }
}
