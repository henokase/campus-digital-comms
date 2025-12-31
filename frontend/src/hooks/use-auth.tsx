import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { requestJson, setStoredToken, getStoredToken } from '@/lib/api-client'

export type AuthUser = {
  id: string
  email: string
  role: 'admin' | 'faculty' | 'student'
  fullName?: string | null
  department?: string | null
  year?: number | null
  createdAt?: string
  updatedAt?: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  isLoading: boolean
  token: string | null
  user: AuthUser | null
  login: (args: { email: string; password: string }) => Promise<AuthUser>
  register: (args: {
    email: string
    password: string
    role: 'admin' | 'faculty' | 'student'
    fullName?: string | null
    department?: string | null
    year?: number | null
  }) => Promise<void>
  refreshProfile: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(getStoredToken()))

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
    setIsLoading(false)
  }, [])

  const refreshProfile = useCallback(async () => {
    const t = getStoredToken()
    if (!t) {
      setIsLoading(false)
      setUser(null)
      setToken(null)
      return
    }

    setIsLoading(true)
    try {
      const res = await requestJson<{ user: AuthUser }>('/api/auth/profile', { method: 'GET' }, { auth: 'required' })
      setUser(res.user)
      setToken(t)
    } catch {
      logout()
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const res = await requestJson<{ token: string; user: AuthUser }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: { email, password },
      },
      { auth: 'none' },
    )

    setStoredToken(res.token)
    setToken(res.token)
    setUser(res.user)
    setIsLoading(false)
    return res.user
  }, [])

  const register = useCallback(
    async ({ email, password, role, fullName, department, year }: {
      email: string
      password: string
      role: 'admin' | 'faculty' | 'student'
      fullName?: string | null
      department?: string | null
      year?: number | null
    }) => {
      await requestJson<{ user: AuthUser }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: {
            email,
            password,
            role,
            fullName: fullName ?? null,
            department: department ?? null,
            year: typeof year === 'number' ? year : null,
          },
        },
        { auth: 'none' },
      )
    },
    [],
  )

  useEffect(() => {
    if (token) {
      refreshProfile()
      return
    }

    const t = getStoredToken()
    if (t) {
      setToken(t)
      refreshProfile()
      return
    }

    setIsLoading(false)
  }, [refreshProfile, token])

  const value = useMemo<AuthContextValue>(() => {
    return {
      isAuthenticated: Boolean(token),
      isLoading,
      token,
      user,
      login,
      register,
      refreshProfile,
      logout,
    }
  }, [isLoading, login, logout, refreshProfile, register, token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
