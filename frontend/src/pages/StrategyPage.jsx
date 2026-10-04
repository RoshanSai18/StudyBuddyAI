import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useStudy } from '../hooks/useStudy'
import PageHead from '../components/PageHead'
import PlanningLoader from '../components/PlanningLoader'

const STRATEGY_STEPS = ['Analysing your topics…', 'Mapping prerequisites…', 'Scoring priorities…', 'Building your day-by-day plan…']

const isoDate = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DEMO = {
  subject: 'Data Structures & Algorithms',
  daysAway: 7,
  dailyHours: 3,
  topics: [
    { name: 'Arrays', confidence: 8, importance: '' },
    { name: 'Linked Lists', confidence: 6, importance: '' },
    { name: 'Trees', confidence: 4, importance: '' },
    { name: 'Graphs', confidence: 2, importance: '' },
    { name: 'Dynamic Programming', confidence: 1, importance: '' },
    { name: 'Sorting', confidence: 7, importance: '' },
  ],
}

let rowId = 0
const blank = () => ({ id: ++rowId, name: '', confidence: 5, importance: '' })
const withIds = (topics) => topics.map((t) => ({ ...t, id: ++rowId }))

export default function StrategyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { priorities, refresh } = useStudy()
  // Arriving from the Notes page: { subject, topics: [{name, confidence, importance}] } pre-fills the form
  // (the student still reviews/adjusts everything here — this is "the one we already have", not a shortcut around it).
  const prefill = location.state?.prefill
  const [subject, setSubject] = useState(prefill?.subject || '')
  const [examDate, setExamDate] = useState(isoDate(7))
  const [dailyHours, setDailyHours] = useState(3)
  const [topics, setTopics] = useState(() => (prefill?.topics?.length ? withIds(prefill.topics) : [blank(), blank(), blank()]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const patch = (id, change) => setTopics((rows) => rows.map((r) => (r.id === id ? { ...r, ...change } : r)))

  const fillDemo = () => {
    setSubject(DEMO.subject)
    setExamDate(isoDate(DEMO.daysAway))
    setDailyHours(DEMO.dailyHours)
    setTopics(withIds(DEMO.topics))
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const named = topics.filter((t) => t.name.trim())
    if (!subject.trim()) return setError('Add a subject.')
    if (!named.length) return setError('Add at least one topic.')
    if (new Set(named.map((t) => t.name.trim().toLowerCase())).size !== named.length) return setError('Each topic should appear once.')
    if (examDate <= isoDate(0)) return setError('Pick an exam date in the future.')
    const hours = Number(dailyHours)
    if (!(hours >= 0.5 && hours <= 16)) return setError('Daily study hours must be between 0.5 and 16.')

    setBusy(true)
    try {
      await api.createStrategy({
        subject: subject.trim(),
        examDate,
        dailyHours: hours,
        topics: named.map((t) => ({
          name: t.name.trim(),
          confidence: Number(t.confidence),
          ...(t.importance !== '' ? { importance: Number(t.importance) } : {}),
        })),
      })
      await refresh()
      navigate('/priorities')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <main className="mc" id="main">
      <PageHead eyebrow="Step 1 · Assess" title="Build your study strategy">
        Tell Quillo what you need to learn and how confident you feel. It ranks your topics, explains why, and builds a plan that fits the days you have left.
      </PageHead>

      {prefill && (
        <div className="infob">
          Pre-filled from your uploaded notes — review the topics and confidence levels below before generating your plan.
        </div>
      )}
      {priorities.length > 0 && (
        <div className="infob">
          You already have a strategy. Generating a new one replaces your current plan and progress. <Link to="/priorities">View current priorities</Link>
        </div>
      )}

      <form className="card pad stack" onSubmit={submit} noValidate>
        <div className="fgrid">
          <div className="fld">
            <label htmlFor="subject">Subject</label>
            <input id="subject" className="sb-in" value={subject} placeholder="e.g. Data Structures & Algorithms" onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="exam">Exam date</label>
            <input id="exam" className="sb-in" type="date" value={examDate} min={isoDate(1)} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="hours">Study hours per day</label>
            <input id="hours" className="sb-in" type="number" min="0.5" max="16" step="0.5" value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} />
          </div>
        </div>

        <div>
          <h2 className="h2" style={{ marginBottom: 6 }}>Topics</h2>
          <p className="hint" style={{ marginBottom: 12 }}>Confidence: 1 means “I have never seen this”, 10 means “I could teach it”. Exam importance is optional; Quillo estimates it if you skip it.</p>
          <div className="thead mono"><span>Topic</span><span>Confidence</span><span>Importance</span><span></span></div>
          {topics.map((t, i) => (
            <div className="trow" key={t.id}>
              <input className="sb-in" aria-label={`Topic ${i + 1} name`} placeholder="Topic name" value={t.name} onChange={(e) => patch(t.id, { name: e.target.value })} />
              <div className="sl">
                <input type="range" min="1" max="10" step="1" aria-label={`${t.name || 'Topic ' + (i + 1)} confidence`} value={t.confidence} onChange={(e) => patch(t.id, { confidence: Number(e.target.value) })} />
                <b>{t.confidence}</b>
              </div>
              <select className="sb-in imp" aria-label={`${t.name || 'Topic ' + (i + 1)} exam importance`} value={t.importance} onChange={(e) => patch(t.id, { importance: e.target.value })}>
                <option value="">Auto</option>
                {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className="ibtn" type="button" aria-label={`Remove ${t.name || 'topic ' + (i + 1)}`} disabled={topics.length === 1} onClick={() => setTopics((rows) => rows.filter((r) => r.id !== t.id))}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
              </button>
            </div>
          ))}
          <div className="ph-row" style={{ marginTop: 12 }}>
            <button className="bs" type="button" onClick={() => setTopics((rows) => [...rows, blank()])}>+ Add topic</button>
            <button className="bs" type="button" onClick={fillDemo}>Use the demo scenario</button>
          </div>
        </div>

        {error && <div className="errb" role="alert">{error}</div>}
        <div className="ph-row">
          <button className="bp" type="submit" disabled={busy}>Generate My Study Strategy</button>
        </div>
      </form>

      {busy && <PlanningLoader title="Building your study strategy…" steps={STRATEGY_STEPS} />}
    </main>
  )
}
