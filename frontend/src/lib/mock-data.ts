export type UserRole = 'admin' | 'faculty' | 'student'

export type User = {
  id: string
  email: string
  role: UserRole
  fullName?: string | null
  department?: string | null
  year?: number | null
  createdAt: string
  updatedAt: string
}

export type AnnouncementTargetAudience = {
  roles?: string[]
  departments?: string[]
  years?: number[]
  [key: string]: unknown
}

export type Announcement = {
  id: string
  title: string
  content: string
  type: string
  category?: string | null
  priority?: string | null
  status?: string | null
  publishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  targetAudience?: AnnouncementTargetAudience | null
}

export type Notification = {
  id: string
  announcementId: string
  userId: string
  channel?: string
  status?: string
  sentAt?: string | null
  readAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type Feedback = {
  id: string
  announcementId: string
  userId?: string | null
  reactionType?: string | null
  comment?: string | null
  rating?: number | null
  isAnonymous: boolean
  createdAt?: string | null
  updatedAt?: string | null
  user?: Partial<User> | null
}

export type AnalyticsDashboard = {
  totalAnnouncements: number
  totalNotificationsSent: number
  totalNotificationsRead: number
  totalFeedbackCount: number
}

function iso(daysAgo: number, hoursAgo = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(d.getHours() - hoursAgo)
  return d.toISOString()
}

function pick<T>(arr: readonly T[], idx: number): T {
  return arr[idx % arr.length]
}

const DEPARTMENTS = ['Software', 'Computer Science', 'Information Systems', 'Electrical', 'Civil'] as const
const CATEGORIES = ['Academic', 'Event', 'Administrative', 'General'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const
const ANNOUNCEMENT_TYPES = ['general', 'exam', 'event', 'administrative'] as const

// Stable UUID-like strings (do not rely on runtime UUID generation so mocks are deterministic)
const IDS = {
  users: {
    student: 'b27c83d7-1b95-4b9c-8e9e-bc1e2f6e7d3f',
    faculty: '7cc6b8b3-85b9-4a0e-9c4d-5d728f5aefc1',
    admin: '0f1f7d8c-6d2c-4c9b-9c74-95a3e3d774a1',
  },
  announcements: Array.from({ length: 18 }, (_, i) =>
    `00000000-0000-4000-8000-${String(100000000000 + i).slice(-12)}`,
  ),
  notifications: Array.from({ length: 30 }, (_, i) =>
    `11111111-1111-4111-8111-${String(100000000000 + i).slice(-12)}`,
  ),
  feedback: Array.from({ length: 24 }, (_, i) =>
    `22222222-2222-4222-8222-${String(100000000000 + i).slice(-12)}`,
  ),
} as const

export const mockUsers: Record<'student' | 'faculty' | 'admin', User> = {
  student: {
    id: IDS.users.student,
    email: 'student@cdcp.edu',
    role: 'student',
    fullName: 'Henok Student',
    department: 'Software',
    year: 2,
    createdAt: iso(40),
    updatedAt: iso(1),
  },
  faculty: {
    id: IDS.users.faculty,
    email: 'faculty@cdcp.edu',
    role: 'faculty',
    fullName: 'Dr. Hana Faculty',
    department: 'Software',
    year: null,
    createdAt: iso(120),
    updatedAt: iso(2),
  },
  admin: {
    id: IDS.users.admin,
    email: 'admin@cdcp.edu',
    role: 'admin',
    fullName: 'System Admin',
    department: null,
    year: null,
    createdAt: iso(365),
    updatedAt: iso(3),
  },
}

export const mockAnnouncements: Announcement[] = Array.from({ length: 18 }, (_, i) => {
  const isPublished = i % 3 !== 0
  const department = pick(DEPARTMENTS, i)
  const year = (i % 4) + 1

  const targetAudience: AnnouncementTargetAudience = {
    roles: ['student'],
    departments: i % 2 === 0 ? [department] : undefined,
    years: i % 2 === 0 ? [year] : undefined,
  }

  return {
    id: IDS.announcements[i],
    title: `Announcement ${i + 1}: ${pick(
      ['Exam schedule update', 'New event announced', 'Registration reminder', 'System maintenance notice'],
      i,
    )}`,
    content:
      `This is a sample announcement used for UI development.\n\n` +
      `Department: ${department}${i % 2 === 0 ? ` (Year ${year})` : ''}\n` +
      `Details: ${
        i % 2 === 0
          ? 'Please read carefully and take the required action.'
          : 'This message is sent campus-wide to all students.'
      }\n\n` +
      `Mock content paragraph #2 to simulate longer announcements and verify layout wrapping, spacing, and typography.`,
    type: pick(ANNOUNCEMENT_TYPES, i),
    category: pick(CATEGORIES, i),
    priority: pick(PRIORITIES, i),
    status: isPublished ? 'published' : 'draft',
    publishedAt: isPublished ? iso(10 - (i % 7), i) : null,
    createdAt: iso(30 - (i % 10), i),
    updatedAt: iso(5 - (i % 3), i),
    targetAudience,
  }
})

export const mockNotifications: Notification[] = Array.from({ length: 30 }, (_, i) => {
  const announcement = mockAnnouncements[i % mockAnnouncements.length]
  const isRead = i % 4 === 0
  const sentAt = iso(7 - (i % 6), i)

  return {
    id: IDS.notifications[i],
    announcementId: announcement.id,
    userId: mockUsers.student.id,
    channel: 'in_app',
    status: 'sent',
    sentAt,
    readAt: isRead ? iso(6 - (i % 6), i - 1) : null,
    createdAt: sentAt,
    updatedAt: isRead ? iso(6 - (i % 6), i - 1) : sentAt,
  }
})

const REACTIONS = ['positive', 'neutral', 'negative', 'question'] as const

export const mockFeedback: Feedback[] = Array.from({ length: 24 }, (_, i) => {
  const announcement = mockAnnouncements[i % mockAnnouncements.length]
  const isAnonymous = i % 3 === 0
  const createdAt = iso(9 - (i % 7), i)

  return {
    id: IDS.feedback[i],
    announcementId: announcement.id,
    userId: isAnonymous ? null : mockUsers.student.id,
    reactionType: pick(REACTIONS, i),
    comment:
      i % 2 === 0
        ? 'This is a sample feedback comment. It helps validate the feedback card UI and text wrapping.'
        : null,
    rating: i % 5 === 0 ? null : ((i % 5) + 1),
    isAnonymous,
    createdAt,
    updatedAt: createdAt,
    user: isAnonymous
      ? null
      : {
          id: mockUsers.student.id,
          email: mockUsers.student.email,
          role: mockUsers.student.role,
          fullName: mockUsers.student.fullName,
          department: mockUsers.student.department,
          year: mockUsers.student.year,
        },
  }
})

export const mockAnalyticsDashboard: AnalyticsDashboard = {
  totalAnnouncements: mockAnnouncements.length,
  totalNotificationsSent: mockNotifications.length,
  totalNotificationsRead: mockNotifications.filter((n) => Boolean(n.readAt)).length,
  totalFeedbackCount: mockFeedback.length,
}

export function getMockAnnouncement(id: string): Announcement | undefined {
  return mockAnnouncements.find((a) => a.id === id)
}

export function getMockNotificationsForUser(userId: string): Notification[] {
  return mockNotifications.filter((n) => n.userId === userId)
}

export function getMockFeedbackForAnnouncement(announcementId: string): Feedback[] {
  return mockFeedback.filter((f) => f.announcementId === announcementId)
}

export function getMockMyFeedback(userId: string): Feedback[] {
  return mockFeedback.filter((f) => f.userId === userId)
}
