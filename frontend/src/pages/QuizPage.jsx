import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useStudy } from '../hooks/useStudy'
import Busy from '../components/Busy'
import PageHead from '../components/PageHead'
import PlanUpdateCard from '../components/PlanUpdateCard'
import { tierOf } from '../tiers'

const DIM = { concept: 'Concept', recall: 'Recall', problem_solving: 'Problem solving', application: 'Application' }

function TopicPicker() {
  const navigate = useNavigate()
  const { priorities } = useStudy()
  return (
    <main className="mc" id="main">
      <PageHead eyebrow="Step 5 · Practise" title="Quiz yourself">
        Pick a topic. Your answers update your mastery, and your plan adjusts to match.
      </PageHead>
      {priorities.length === 0 ? (
        <section className="card empty">
          <h2>No topics yet</h2>
          <p>Build your study strategy first and your topics will appear here.</p>
          <Link className="bp" to="/strategy">Build my study strategy</Link>
        </section>
      ) : (
        <div className="qz-pick">
          {priorities.map((p) => (
            <button type="button" key={p.topic} onClick={() => navigate(`/quiz/${encodeURIComponent(p.topic)}`)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span className="dotc" style={{ background: tierOf(p.tier).c }}></span>{p.topic}
              </span>
              <span className="mono" style={{ color: 'var(--mu)' }}>{p.mastery}% mastery</span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

function Quiz({ topic }) {
  const navigate = useNavigate()
  const { refresh } = useStudy()
  const [quiz, setQuiz] = useState(null)
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState(null)
  const [text, setText] = useState('')
  const [graded, setGraded] = useState({}) // questionId -> result
  const [summary, setSummary] = useState(null) // last server reply (running score, mastery, plan update)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    let live = true
    setBusy(true)
    setError('')
    setQuiz(null)
    setIndex(0)
    setGraded({})
    setSummary(null)
    setChoice(null)
    setText('')
    api
      .generateQuiz(topic, 5)
      .then((q) => live && setQuiz(q))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setBusy(false))
    return () => {
      live = false
    }
  }

  useEffect(load, [topic]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <main className="mc" id="main">
        <div className="errb" role="alert">{error}</div>
        <div className="ph-row"><button className="bs" type="button" onClick={load}>Try again</button><Link className="bs" to="/quiz">Pick another topic</Link></div>
      </main>
    )
  }
  if (!quiz) return <main className="mc"><Busy>Writing your {topic} quiz…</Busy></main>

  const total = quiz.questions.length
  const q = quiz.questions[index]
  const result = graded[q?.id]
  const complete = summary?.quiz_complete
  const answer = q?.type === 'mcq' ? choice : text.trim()

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.evaluateQuiz(quiz.quiz_id, [{ questionId: q.id, answer }])
      setGraded((g) => ({ ...g, [q.id]: { ...res.results[0], answer } }))
      setSummary(res)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const advance = () => {
    setIndex((i) => i + 1)
    setChoice(null)
    setText('')
  }

  // results view: after the last answer has been reviewed
  if (summary && complete && index >= total) {
    const rows = quiz.questions.map((qq) => ({ q: qq, r: graded[qq.id] }))
    return (
      <main className="mc" id="main">
        <PageHead eyebrow="Quiz complete" title={`${topic}: ${summary.quiz_correct} of ${summary.quiz_total} correct`}>
          Your {topic} mastery is now {summary.mastery.overall}%.
        </PageHead>
        <section className="card done-card">
          <div className="big">{summary.quiz_score}%</div>
          <div className="pb"><i style={{ width: `${summary.quiz_score}%`, background: 'var(--ac)' }}></i></div>
          <div>
            {rows.map(({ q: qq, r }, i) => (
              <div className="res" key={qq.id}>
                <span className="mono" style={{ color: r?.correct ? '#2f6b45' : '#9a4f3c' }}>Question {i + 1} · {DIM[qq.dimension] || qq.dimension} · {r?.correct ? 'Correct ✓' : 'Missed'}</span>
                <span className="rq">{qq.prompt}</span>
                {r?.explanation && <span className="hint">{r.explanation}</span>}
              </div>
            ))}
          </div>
          <div className="ph-row">
            <button className="bp" type="button" onClick={load}>Retake with new questions</button>
            <Link className="bs" to="/plan">See my plan</Link>
            <button className="bs" type="button" onClick={() => navigate(`/learn/${encodeURIComponent(topic)}`)}>Back to the lesson</button>
          </div>
        </section>
        <PlanUpdateCard update={summary.plan_update} />
      </main>
    )
  }

  return (
    <main className="mc" id="main">
      <PageHead eyebrow={`Step 5 · Practise · ${topic}`} title={`Question ${index + 1} / ${total}`}>
        {DIM[q.dimension] || q.dimension} question
      </PageHead>
      <section className="card q-card">
        <div className="pb"><i style={{ width: `${(Object.keys(graded).length / total) * 100}%`, background: 'var(--ac)' }}></i></div>
        <h3>{q.prompt}</h3>

        {q.type === 'mcq' ? (
          <div className="opts" role="radiogroup" aria-label="Answer options">
            {q.options.map((o, i) => {
              const state = result ? (i === result.correct_index ? ' right' : result.answer === i ? ' wrong' : '') : ''
              return (
                <button key={i} type="button" role="radio" aria-checked={(result ? result.answer : choice) === i ? 'true' : 'false'} className={`opt${state}`} disabled={!!result || busy} onClick={() => setChoice(i)}>
                  <span className="k">{String.fromCharCode(65 + i)}</span>
                  <span>{o}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <textarea className="sb-in" aria-label="Your answer" placeholder="Write your answer in your own words…" value={result ? result.answer : text} disabled={!!result || busy} onChange={(e) => setText(e.target.value)} />
        )}

        {result && (
          <div className={`fb ${result.correct ? 'ok' : 'bad'}`} role="status">
            <b>{result.correct ? 'Correct ✓' : 'Not quite'} · {result.score}%</b>
            <span>{result.feedback}</span>
            {!result.correct && result.misconception && <span className="mis">Likely misconception: {result.misconception}</span>}
            {result.explanation && <span><b>Why?</b> {result.explanation}</span>}
          </div>
        )}

        <div className="q-actions">
          {!result && <button className="bp" type="button" disabled={busy || answer === null || answer === ''} onClick={submit}>Submit answer</button>}
          {result && <button className="bp" type="button" onClick={advance}>{index < total - 1 ? 'Next question' : 'See results'}</button>}
          {busy && <Busy>Checking…</Busy>}
        </div>
      </section>
    </main>
  )
}

export default function QuizPage() {
  const { topic } = useParams()
  return topic ? <Quiz key={topic} topic={topic} /> : <TopicPicker />
}
