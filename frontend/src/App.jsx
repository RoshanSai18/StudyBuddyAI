import { Navigate, Route, Routes } from 'react-router-dom'
import ShellLayout from './components/ShellLayout'
import DashboardPage from './pages/DashboardPage'
import LandingPage from './pages/LandingPage'
import LearnPage from './pages/LearnPage'
import LoginPage from './pages/LoginPage'
import PlanPage from './pages/PlanPage'
import PrioritiesPage from './pages/PrioritiesPage'
import QuizPage from './pages/QuizPage'
import StrategyPage from './pages/StrategyPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ShellLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/strategy" element={<StrategyPage />} />
        <Route path="/priorities" element={<PrioritiesPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/learn/:topic" element={<LearnPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/quiz/:topic" element={<QuizPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
