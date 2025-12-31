import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/use-auth'

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RequireAdminOrFaculty() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user?.role !== 'admin' && user?.role !== 'faculty') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function DisallowAdminFacultyOutsideDashboard() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return
    if (user?.role !== 'admin' && user?.role !== 'faculty') return

    const path = location.pathname
    const allowedPrefixes = ['/dashboard', '/login', '/signup']
    const isAllowed = allowedPrefixes.some((p) => path === p || path.startsWith(`${p}/`))
    if (!isAllowed) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate, user?.role])

  return <Outlet />
}
