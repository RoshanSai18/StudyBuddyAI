import { Navigate, Outlet, useLocation } from 'react-router-dom'
import dashboardCss from '../styles/dashboard.css?inline'
import studyCss from '../styles/study.css?inline'
import { useScopedStyle } from '../hooks/useScopedStyle'
import { StudyProvider } from '../hooks/useStudy'
import { isAuthed } from '../auth'
import Sidebar from './Sidebar'

// The dashboard frame (sidebar + content). Only the home page has the right-hand panel.
export default function ShellLayout() {
  useScopedStyle(dashboardCss, studyCss)
  const { pathname } = useLocation()
  if (!isAuthed()) return <Navigate to="/login" replace />
  return (
    <StudyProvider>
      <div className={`db${pathname === '/dashboard' ? '' : ' nr'}`}>
        <Sidebar />
        <Outlet />
      </div>
    </StudyProvider>
  )
}
