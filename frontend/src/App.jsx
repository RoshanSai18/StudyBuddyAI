import { Navigate, Route, Routes } from 'react-router-dom'
import ShellLayout from './components/ShellLayout'
import AskTutorPage from './pages/AskTutorPage'
import DashboardPage from './pages/DashboardPage'
import DemoPage from './pages/DemoPage'
import FlashcardsPage from './pages/FlashcardsPage'
import LandingPage from './pages/LandingPage'
import LearnPage from './pages/LearnPage'
import LoginPage from './pages/LoginPage'
import NotesPage from './pages/NotesPage'
import PipelinePage from './pages/PipelinePage'
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
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/ask" element={<AskTutorPage />} />
        <Route path="/priorities" element={<PrioritiesPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/learn/:topic" element={<LearnPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/quiz/:topic" element={<QuizPage />} />
        <Route path="/flashcards" element={<FlashcardsPage />} />
        <Route path="/flashcards/:topic" element={<FlashcardsPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/demo" element={<DemoPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
