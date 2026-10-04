import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHead from '../components/PageHead'
import PipelineVisualizer from '../components/PipelineVisualizer'
import KnowledgeMap from '../components/KnowledgeMap'
import PlanUpdateCard from '../components/PlanUpdateCard'
import { useStudy } from '../hooks/useStudy'
import { runDemo } from '../services/demoScript'

const STEP_DELAY_MS = 1100

export default function DemoPage() {
  const navigate = useNavigate()
  const { refresh } = useStudy()
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const [planUpdate, setPlanUpdate] = useState(null)
  const [error, setError] = useState('')
  const guard = useRef(0)

  const run = async () => {
    const myRun = ++guard.current
    setRunning(true)
    setError('')
    setLog([])
    setPlanUpdate(null)
    try {
      for await (const step of runDemo()) {
        if (guard.current !== myRun) return
        setLog((l) => [...l, step.narration])
        if (step.planUpdate) setPlanUpdate(step.planUpdate)
        await new Promise((r) => setTimeout(r, STEP_DELAY_MS))
      }
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      if (guard.current === myRun) setRunning(false)
    }
  }

  return (
    <main className="mc" id="main">
      <PageHead
        eyebrow="Demo"
        title="Watch the full loop run"
        actions={
          <>
            <button className="bp" type="button" disabled={running} onClick={run}>
              {running ? 'Running demo…' : 'Run demo'}
            </button>
            <button className="bs" type="button" disabled={running} onClick={() => navigate('/dashboard')}>Go to dashboard</button>
          </>
        }
      >
        One click drives the real DSA scenario end to end — plan generation, a deliberately wrong answer, misconception detection, re-teaching, mastery change, and adaptive replanning — through the actual API, not mocked data.
      </PageHead>

      {error && <div className="errb" role="alert">{error}</div>}

      <section className="card pad demo-log" aria-label="Demo narration" aria-live="polite">
        <p className="lab mono" style={{ marginBottom: 2 }}>Narration</p>
        {log.length === 0 && !running && <p className="hint">Click "Run demo" to start.</p>}
        <ol>
          {log.map((line, i) => (
            <li key={i} style={{ '--i': i }}>{line}</li>
          ))}
        </ol>
      </section>

      <PlanUpdateCard update={planUpdate} />

      <PipelineVisualizer />
      <KnowledgeMap />
    </main>
  )
}
