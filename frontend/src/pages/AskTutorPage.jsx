import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useStudy } from '../hooks/useStudy'
import PageHead from '../components/PageHead'
import PlanningLoader from '../components/PlanningLoader'
import { TUTORS } from '../tutors'

const ASK_STEPS = ['Understanding your question…', 'Choosing the right workspace…', 'Setting up your lesson…']
const SUGGESTIONS = [
  'Teach me Python recursion',
  'Explain acid-base titration',
  'Help me solve an integration problem',
  'Explain projectile motion',
]

export default function AskTutorPage() {
  const navigate = useNavigate()
  const { refresh } = useStudy()
  const [q, setQ] = useState('')
  const [tutor, setTutor] = useState(TUTORS[0].name)
  const [phase, setPhase] = useState('idle') // 'idle' | 'think' | 'done' | 'error'
  const [detected, setDetected] = useState(null)
  const [error, setError] = useState('')
  const t1 = useRef(null)

  // The AI decides the subject/topic/workspace from free text (Adaptive Subject Workspace system), starts
  // (or resumes) a learning session for it, and the student is handed off into that workspace automatically.
  const send = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    const text = q.trim()
    if (!text || phase === 'think') return
    setPhase('think')
    setError('')
    clearTimeout(t1.current)
    try {
      const res = await api.askTutor(text)
      setDetected(res.detected)
      setPhase('done')
      refresh() // the new/updated topic should show up in the sidebar and priorities right away
      t1.current = setTimeout(() => navigate(`/learn/${encodeURIComponent(res.session.topic)}`), 900)
    } catch (err) {
      setPhase('error')
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  const pickSuggestion = (t) => {
    setQ(t)
    document.getElementById('ask-q')?.focus()
  }

  if (phase === 'think') {
    return (
      <main className="mc" id="main">
        <PageHead eyebrow="Ask your tutor" title="Ask anything">
          Type a topic or question — Quillo figures out the subject and opens the right workspace for it.
        </PageHead>
        <PlanningLoader title="Thinking about the best way to teach this…" steps={ASK_STEPS} />
      </main>
    )
  }

  return (
    <main className="mc" id="main">
      <PageHead eyebrow="Ask your tutor" title="Ask anything">
        Type a topic or question in your own words. Quillo detects the subject, opens the right workspace — coding, chemistry, math,
        physics, biology or a general one — and starts teaching.
      </PageHead>

      <section className="card ask-card" aria-labelledby="ask-h">
        <div className="ask-head">
          <h2 id="ask-h" className="h2">What do you want to learn?</h2>
          <label className="who-sel" htmlFor="tutor">Asking
            <select id="tutor" value={tutor} onChange={(e) => setTutor(e.target.value)}>
              {TUTORS.map((o) => (<option key={o.name} value={o.name}>{o.name}</option>))}
            </select>
          </label>
        </div>
        <form className="ask" onSubmit={send}>
          <label htmlFor="ask-q" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Your question</label>
          <textarea id="ask-q" rows="3" placeholder="e.g. Teach me Python loops, or explain projectile motion…" value={q} onChange={(e) => setQ(e.target.value)}></textarea>
          <div className="ask-bar">
            <div style={{ display: 'flex', gap: '2px' }}>
              <button className="ibtn" type="button" aria-label="Upload an image"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="15" rx="2.5"></rect><circle cx="9" cy="9.5" r="1.6"></circle><path d="M20.5 15l-4.5-4.5L7 19.5"></path></svg></button>
              <button className="ibtn" type="button" aria-label="Ask with your voice"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"></path></svg></button>
            </div>
            <button className="send" type="submit" disabled={!q.trim()}>Ask<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>
          </div>
        </form>
        <div className="sugg" role="list" aria-label="Example questions">
          {SUGGESTIONS.map((t) => (
            <button className="chip" type="button" role="listitem" key={t} onClick={() => pickSuggestion(t)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg>{t}</button>
          ))}
        </div>

        {phase === 'done' && detected && (
          <div className="convo" aria-live="polite">
            <div className="msg tu">
              <b>{detected.workspace_meta?.label || 'Quillo'}</b>
              <span>Opening the <b>{detected.workspace_meta?.label || 'study workspace'}</b> for <b>{detected.topic}</b>…</span>
            </div>
          </div>
        )}
        {phase === 'error' && <div className="errb" role="alert">{error}</div>}
      </section>
    </main>
  )
}
