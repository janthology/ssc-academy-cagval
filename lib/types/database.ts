export interface User {
  id: string
  email: string
  name: string
  user_type: "individual" | "lgu" | "suc" | "hei" | "dost" | "government"
  organization?: string
  organization_id?: string | null
  position?: string
  region: string
  province?: string
  city?: string
  avatar?: string
  created_at: string
  updated_at: string
  is_admin?: boolean;
  is_instructor?: boolean;
  status?: "pending" | "active" | "inactive";
}

export interface Event {
  id: string
  title: string
  description: string
  event_type: "live_session" | "hands_on" | "conference"
  starts_at: string
  ends_at?: string | null
  location?: string | null
  is_published: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description: string
  category: string
  level: 'beginner' | 'intermediate' | 'advanced'
  duration: number
  target_audience: string[]
  prerequisites: string[] | null
  thumbnail: string
  instructor: string
  instructor_id?: string | null
  rating: number | null
  enrollment_count: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  skills: string[] | null
  modules?: Module[]
  learning_outcomes?: LearningOutcome[]
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string
  order: number
  estimated_duration: number
  is_required: boolean
  lessons?: Lesson[]
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  type: 'video' | 'text' | 'quiz' | 'assignment' | 'pdf'
  order: number
  duration: number
  start_page: number
}

export interface Resource {
  id: string
  module_id: string
  type: 'pdf' | 'video' | 'link' | 'document'
  path: string
}

export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  status: "active" | "completed" | "dropped"
  progress: number
  enrolled_at: string
  completed_at?: string
  last_accessed_at: string
  grade?: number
  course?: Partial<Course>
}

export interface Certificate {
  id: string
  user_id: string
  course_id: string
  certificate_number: string
  issued_at: string
  verification_hash: string
  status: "active" | "revoked"
  course?: Partial<Course>
  user?: Partial<User>
  enrollment?: Partial<Enrollment>
}

export interface Progress {
  id: string
  user_id: string
  course_id: string
  module_id: string | null
  lesson_id: string | null
  completed: boolean
  completed_at: string | null
  time_spent: number
}

export interface Organization {
  id: string
  name: string
  type: "lgu" | "suc" | "hei" | "government"
  region: string
  province?: string
  city?: string
  contact_email: string
  contact_person: string
  is_verified: boolean
  created_at: string
}

export interface EnrolledCourse {
  id: string
  title: string
  instructor?: string
  progress: number
  status: "In Progress" | "Completed"
  nextLesson: string
  timeSpent: string
  estimatedTime: string
  lastAccessed: string
  rating: number
  image: string
  completed_at?: string
  certificateId?: string | null
  learning_path_id?: string | null // Added to associate with learning path
}

export interface LearningOutcome {
  id: string
  course_id: string
  outcome: string
  order: number
}

export interface LearningPath {
  id: string
  title: string
  description: string
  target_audience: string[]
  status: "active" | "archived"
  created_at: string
  updated_at: string
  created_by: string
  courses?: {
    id: string
    title: string
    course_order: number
    progress?: number // Optional progress for enrolled users
  }[]
}