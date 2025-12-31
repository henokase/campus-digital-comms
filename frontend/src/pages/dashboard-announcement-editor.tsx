import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-error'
import type { Announcement, AnnouncementTargetAudience } from '@/lib/announcements-api'
import { createAnnouncement, getAnnouncement, updateAnnouncement } from '@/lib/announcements-api'

const DEPARTMENTS = [
  'Software',
  'Computer Science',
  'Information Systems',
  'Electrical',
  'Civil',
]

const YEARS = [1, 2, 3, 4, 5]

const CATEGORIES = [
  'Academic',
  'Events',
  'Exams',
  'Registration',
  'Scholarships',
  'Clubs',
  'Housing',
  'Library',
  'Sports',
  'General',
] as const

type FormState = {
  title: string
  content: string
  type: string
  category: string
  priority: string
  departments: Record<string, boolean>
  years: Record<number, boolean>
}

function fromAnnouncement(a: Announcement | null): FormState {
  const depsArr = Array.isArray(a?.targetAudience?.departments) ? a?.targetAudience?.departments : []
  const yearsArr = Array.isArray(a?.targetAudience?.years) ? a?.targetAudience?.years : []

  return {
    title: a?.title ?? '',
    content: a?.content ?? '',
    type: a?.type ?? 'general',
    category: a?.category ?? '',
    priority: a?.priority ?? 'medium',
    departments: Object.fromEntries(DEPARTMENTS.map((d) => [d, depsArr.includes(d)])),
    years: Object.fromEntries(YEARS.map((y) => [y, yearsArr.includes(y)])),
  }
}

function toTargetAudience(state: FormState): AnnouncementTargetAudience {
  const departments = Object.entries(state.departments)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const years = Object.entries(state.years)
    .filter(([, v]) => v)
    .map(([k]) => Number(k))
    .filter((n) => Number.isFinite(n))

  return {
    roles: ['student'],
    departments,
    years,
  }
}

export function DashboardAnnouncementEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const isCreate = !id

  const [form, setForm] = useState<FormState>(() => fromAnnouncement(null))
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const title = useMemo(() => (isCreate ? 'Create announcement' : 'Edit announcement'), [isCreate])

  useEffect(() => {
    if (isCreate) {
      setForm(fromAnnouncement(null))
      setIsLoading(false)
      return
    }

    if (!id) return

    const announcementId = id

    let cancelled = false

    async function run() {
      setIsLoading(true)
      setError(null)
      try {
        const a = await getAnnouncement(announcementId)
        if (cancelled) return
        setForm(fromAnnouncement(a))
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setError(err.message)
        else if (err instanceof Error) setError(err.message)
        else setError('Failed to load announcement.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id, isCreate])

  async function onSave() {
    setError(null)

    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    if (!form.content.trim()) {
      setError('Content is required.')
      return
    }
    if (!form.type.trim()) {
      setError('Type is required.')
      return
    }
    if (!form.priority.trim()) {
      setError('Priority is required.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        category: form.category.trim() ? form.category.trim() : null,
        priority: form.priority,
        targetAudience: toTargetAudience(form),
      }

      if (isCreate) {
        await createAnnouncement(payload)
        navigate(`/dashboard/announcements`)
      } else if (id) {
        await updateAnnouncement(id, payload)
        navigate(`/dashboard/announcements`)
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else if (err instanceof Error) setError(err.message)
      else setError('Failed to save announcement.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Card className="border-purple-100">
          <CardHeader>
            <div className="flex flex-col gap-3 -mb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-purple-700 pl-2">{title}</CardTitle>
                {/* <CardDescription>
                  {announcement ? 'Update announcement details and audience.' : 'Create a new announcement for students.'}
                </CardDescription> */}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-full border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => navigate('/dashboard')}
                >
                  Back
                </Button>
                <Button className="rounded-full bg-purple-600 text-white hover:bg-purple-700" onClick={onSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="border-purple-100 lg:col-span-2">
                  {/* <CardHeader className="pb-2">
                    <CardTitle className="text-base">Details</CardTitle>
                  </CardHeader> */}
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="E.g., Midterm schedule update"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        value={form.content}
                        onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                        placeholder="Write the announcement details here..."
                        className="min-h-[200px]"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label>Type</Label>
                        <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                            <SelectItem value="alert">Alert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Priority</Label>
                        <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-100">
                  <CardHeader className="">
                    <CardTitle className="text-base -mb-5">Target audience</CardTitle>
                    {/* <CardDescription>Select who should receive this announcement.</CardDescription> */}
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                      <div className="text-xs text-muted-foreground">Departments</div>
                      <div className="grid gap-2">
                        {DEPARTMENTS.map((d) => (
                          <label key={d} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                            <Checkbox
                              checked={Boolean(form.departments[d])}
                              onCheckedChange={(v) =>
                                setForm((p) => ({ ...p, departments: { ...p.departments, [d]: Boolean(v) } }))
                              }
                            />
                            <span className="truncate">{d}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs text-muted-foreground">Years</div>
                      <div className="grid gap-2">
                        {YEARS.map((y) => (
                          <label key={y} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                            <Checkbox
                              checked={Boolean(form.years[y])}
                              onCheckedChange={(v) => setForm((p) => ({ ...p, years: { ...p.years, [y]: Boolean(v) } }))}
                            />
                            <span>Year {y}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
