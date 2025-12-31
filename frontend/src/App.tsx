import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AnnouncementDetailsPage } from '@/pages/announcement-details'
import { DisallowAdminFacultyOutsideDashboard, RequireAdminOrFaculty } from '@/components/auth/role-guards'
import { DashboardPage } from '@/pages/dashboard'
import { DashboardAnnouncementEditorPage } from '@/pages/dashboard-announcement-editor'
import { HomePage } from '@/pages/home'
import { LoginPage } from '@/pages/login'
import { NotificationsPage } from '@/pages/notifications'
import { SignupPage } from '@/pages/signup'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DisallowAdminFacultyOutsideDashboard />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route path="/" element={<HomePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/announcements/:id" element={<AnnouncementDetailsPage />} />

          <Route element={<RequireAdminOrFaculty />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/announcements/new" element={<DashboardAnnouncementEditorPage />} />
            <Route path="/dashboard/announcements/:id/edit" element={<DashboardAnnouncementEditorPage />} />
          </Route>

          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App