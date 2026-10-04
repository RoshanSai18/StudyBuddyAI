import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useStudy } from '../hooks/useStudy'
import Busy from '../components/Busy'
import Markdown from '../components/Markdown'
import PlanUpdateCard from '../components/PlanUpdateCard'
import XpToast from '../components/XpToast'

const GLYPH = { done: '✓', current: '●', pending: '○', revisit: '↻' }
const DIMS = [
  ['concept', 'Concept understanding'],
  ['recall', 'Recall'],
  ['problem_solving', 'Problem solving'],
  ['application', 'Application'],
]
const KIND = {
  concept: 'Concept', analogy: 'Analogy', example: 'Example', worked_example: 'Worked example', code: 'Code', trace: 'Trace',
  practice: 'Practice', recall: 'Recall', application: 'Application', challenge: 'Challenge', summary: 'Summary',
}
// models sometimes wrap snippets in markdown fences even in plain fields
const unfence = (s) => (s || '').replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '').trim()

const STYLES = [
  ['different', 'Explain differently'],
  ['simpler', 'Make it simpler'],
  ['example', 'Show an example'],
]

export default function LearnPage() {
  const { topic } = useParams()
  const navigate = useNavigate()
  const { refresh, setXp } = useStudy()

  const [session, setSession] = useState(null)
  const [resumed, setResumed] = useState(false)
  const [pending, setPending] = useState(null) // the server's reply to the last answer, shown before "Continue"
  const [choice, setChoice] = useState(null)
  const [text, setText] = useState('')
  const [conf, setConf] = useState(null)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [planUpdate, setPlanUpdate] = useState(null)

  const reset = () => {
    setPending(null)
    setChoice(null)
    setText('')
    setConf(null)
    setHint('')
  }

  const start = async (resume) => {
    setBusy('start')
    setError('')
    reset()
    setPlanUpdate(null)
    try {
      const res = await api.startLearning(topic, resume)
      setSession(res.session)
      setResumed(res.resumed)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    let live = true
    setSession(null)
    setBusy('start')
    setError('')
    reset()
    setPlanUpdate(null)
    api
      .startLearning(topic, true)
      .then((res) => {
        if (!live) return
        setSession(res.session)
        setResumed(res.resumed)
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setBusy(''))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic])

  const q = session?.question
  const answer = q?.type === 'mcq' ? choice : text.trim()
  const canSubmit = !pending && !busy && answer !== null && answer !== ''

  const submit = async () => {
    setBusy('answer')
    setError('')
    try {
      const res = await api.answer(session.id, answer, conf || undefined)
      setPending(res)
      if (res.plan_update) setPlanUpdate(res.plan_update)
      if (res.xp) setXp(res.xp)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const next = () => {
    setSession(pending.session)
    reset()
  }

  const askHint = async () => {
    try {
      setHint((await api.hint(session.id)).hint)
    } catch (e) {
      setError(e.message)
    }
  }

  const rephrase = async (style) => {
    setBusy('rephrase')
    setError('')
    try {
      const res = await api.rephrase(session.id, style)
      setSession(res.session)
      reset()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  if (!session) {
    return (
      <main className="mc" id="main">
        {error ? (
          <>
            <div className="errb" role="alert">{error}</div>
            <div className="ph-row"><Link className="bs" to="/strategy">Build a study strategy</Link><Link className="bs" to="/priorities">Priorities</Link></div>
          </>
        ) : (
          <Busy>Your tutor is choosing how to teach {topic} and preparing the first lesson…</Busy>
        )}
      </main>
    )
  }

  const mastery = (pending?.mastery ?? session.mastery) || { overall: 0 }
  const complete = session.status === 'complete'
  const ev = pending?.evaluation
  const done = session.outline.filter((o) => o.status === 'done').length

  return (
    <main className="mc" id="main">
      <section className="card pad">
        <div className="lw-h">
          <div>
            <span className="mono" style={{ color: 'var(--ac)' }}>Step 4 · Learn</span>
            <h1 className="h2" style={{ fontSize: 32, marginTop: 6 }}>{session.topic}</h1>
            <div className="ph-row">
              {session.workspace_meta && (
                <span className="cls" style={{ background: `color-mix(in srgb, ${session.workspace_meta.accent} 16%, white)`, color: session.workspace_meta.accent }}>
                  <span className="dotc" style={{ background: session.workspace_meta.accent }}></span>{session.workspace_meta.label}
                </span>
              )}
              <span className="pill">{session.mode} lesson</span>
              <span className="pill">Level {session.difficulty}/5</span>
              <span className="pill">{done}/{session.outline.length} steps</span>
              {resumed && <span className="pill">Resumed</span>}
            </div>
          </div>
          <div className="lw-m">
            <span className="mono" style={{ color: 'var(--mu)' }}>Mastery</span>
            <div className="count"><b>{mastery.overall}%</b></div>
            <div className="pb"><i style={{ width: `${mastery.overall}%`, background: 'var(--ac)' }}></i></div>
          </div>
        </div>
      </section>

      {error && <div className="errb" role="alert">{error}</div>}

      <div className="lw">
        <aside className="card pad" aria-label="Lesson outline">
          <h2 className="h2" style={{ fontSize: 18 }}>Learning</h2>
          <ol className="outline">
            {session.outline.map((o) => (
              <li key={o.id} className={o.status} aria-current={o.status === 'current' ? 'step' : undefined}>
                <span className="g" aria-hidden="true">{GLYPH[o.status]}</span>
                <span>{o.title}</span>
              </li>
            ))}
          </ol>
          <div className="dims">
            <p className="lab mono" style={{ marginBottom: 2 }}>Mastery breakdown</p>
            {DIMS.map(([k, label]) => (
              <div className="lr" key={k}>
                <span>{label}</span>
                <span className="t" role="meter" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={mastery[k] ?? 0}><i style={{ width: `${mastery[k] ?? 0}%`, background: 'var(--ac)' }}></i></span>
              </div>
            ))}
          </div>
          <button className="bs sm" type="button" style={{ marginTop: 14 }} disabled={!!busy} onClick={() => start(false)}>Start over</button>
        </aside>

        <div className="coach">
          {complete ? (
            <>
              <section className="card done-card">
                <span className="mono" style={{ color: 'var(--ac)' }}>Lesson complete</span>
                <h2>You finished {session.topic}</h2>
                <div className="big">{mastery.overall}% mastery</div>
                <p className="hint">
                  {session.outline.some((o) => o.status === 'revisit')
                    ? 'Some steps are marked for revisiting. Your plan has been adjusted to give them more time.'
                    : 'Your plan has been adjusted to match what you now know.'}
                </p>
                <div className="ph-row">
                  <button className="bp" type="button" onClick={() => navigate(`/quiz/${encodeURIComponent(session.topic)}`)}>Take a quiz on {session.topic}</button>
                  <Link className="bs" to="/plan">See my plan</Link>
                  <Link className="bs" to="/priorities">Next topic</Link>
                </div>
              </section>
              <PlanUpdateCard update={planUpdate} />
            </>
          ) : (
            <>
              <section className="card lesson" aria-live="polite">
                <div className="tagrow">
                  <span className="tag">{KIND[session.lesson.step_kind] || 'Lesson'}</span>
                  {session.lesson.reteach && <span className="tag">New explanation</span>}
                </div>
                <h2>{session.lesson.title}</h2>
                {session.lesson.reteach && session.lesson.misconception_addressed && (
                  <p className="hint">Addressing: {session.lesson.misconception_addressed}</p>
                )}
                <Markdown text={session.lesson.body} />
                {unfence(session.lesson.code) && <div className="md"><pre><code>{unfence(session.lesson.code)}</code></pre></div>}
                {unfence(session.lesson.visual) && !session.lesson.body.includes(unfence(session.lesson.visual)) && <div className="md"><pre><code>{unfence(session.lesson.visual)}</code></pre></div>}
                <div className="ph-row" style={{ marginTop: 0 }}>
                  {STYLES.map(([style, label]) => (
                    <button className="chip" type="button" key={style} disabled={!!busy || !!pending} onClick={() => rephrase(style)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg>{label}
                    </button>
                  ))}
                </div>
                {busy === 'rephrase' && <Busy>Finding another way to explain it…</Busy>}
              </section>

              <section className="card q-card" aria-label="Question">
                <span className="mono" style={{ color: 'var(--mu)' }}>Check your understanding</span>
                <h3>{q.prompt}</h3>

                {q.type === 'mcq' ? (
                  <div className="opts" role="radiogroup" aria-label="Answer options">
                    {q.options.map((o, i) => (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={choice === i ? 'true' : 'false'}
                        className={`opt${pending && choice === i ? (ev?.correct ? ' right' : ' wrong') : ''}`}
                        disabled={!!pending || !!busy}
                        onClick={() => setChoice(i)}
                      >
                        <span className="k">{String.fromCharCode(65 + i)}</span>
                        <span>{o}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    {q.type === 'code' && <span className="mono" style={{ color: 'var(--mu)' }}>Code editor</span>}
                    <textarea className="sb-in" aria-label="Your answer" placeholder={q.type === 'code' ? 'Write your code or pseudocode…' : 'Write your answer in your own words…'} value={text} disabled={!!pending || !!busy} onChange={(e) => setText(e.target.value)} style={q.type === 'code' ? { fontFamily: 'var(--mono)', fontSize: 14.5 } : undefined} />
                  </>
                )}

                {hint && <div className="hintb"><b>Hint:</b> {hint}</div>}

                {ev && (
                  <div className={`fb ${ev.correct ? 'ok' : 'bad'}`} role="status">
                    <b>{ev.correct ? 'Correct ✓' : ev.moved_on ? 'Let’s move on for now' : 'Not quite yet'} · {ev.score}%</b>
                    <span>{ev.feedback}</span>
                    {!ev.correct && ev.misconception && <span className="mis">Likely misconception: {ev.misconception}</span>}
                    {ev.overconfident && <span className="mis">You were quite sure about that one. Worth double-checking this idea.</span>}
                    {ev.explanation && <span><b>Why?</b> {ev.explanation}</span>}
                  </div>
                )}
                {pending?.xp_gained?.length > 0 && <XpToast gains={pending.xp_gained} />}

                {!pending && (
                  <>
                    <div className="conf" role="group" aria-label="How sure are you?">
                      <span>How sure are you?</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" aria-pressed={conf === n ? 'true' : 'false'} onClick={() => setConf(conf === n ? null : n)}>{n}</button>
                      ))}
                    </div>
                    <div className="q-actions">
                      <button className="bp" type="button" disabled={!canSubmit} onClick={submit}>Submit answer</button>
                      <button className="bs" type="button" disabled={!!busy} onClick={askHint}>Give me a hint</button>
                      {busy === 'answer' && <Busy>Checking your answer…</Busy>}
                    </div>
                  </>
                )}

                {pending && (
                  <div className="q-actions">
                    <button className="bp" type="button" onClick={next}>
                      {pending.session_complete ? 'See my results' : ev?.correct || ev?.moved_on ? 'Continue' : 'Try it with a new explanation'}
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
