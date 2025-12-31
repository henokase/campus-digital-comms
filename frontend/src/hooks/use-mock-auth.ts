import { useCallback, useMemo, useState } from 'react'

import { mockFeedback, mockNotifications, mockUsers } from '@/lib/mock-data'

export function useMockAuth() {
  const [mockAuthed, setMockAuthed] = useState(() => {
    return localStorage.getItem('cdcp.mockAuthed') === '1'
  })

  const isAuthenticated = mockAuthed
  const user = mockUsers.student

  const unreadCount = useMemo(() => {
    if (!isAuthenticated) return 0
    return mockNotifications.filter((n) => n.userId === user.id && !n.readAt).length
  }, [isAuthenticated, user.id])

  const myFeedback = useMemo(() => {
    if (!isAuthenticated) return []
    return mockFeedback.filter((f) => f.userId === user.id)
  }, [isAuthenticated, user.id])

  const signInMock = useCallback(() => {
    localStorage.setItem('cdcp.mockAuthed', '1')
    setMockAuthed(true)
  }, [])

  const signOutMock = useCallback(() => {
    localStorage.removeItem('cdcp.mockAuthed')
    setMockAuthed(false)
  }, [])

  return {
    isAuthenticated,
    user,
    unreadCount,
    myFeedback,
    signInMock,
    signOutMock,
  }
}
