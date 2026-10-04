import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import Busy from '../components/Busy'
import PageHead from '../components/PageHead'
import { tierOf } from '../tiers'

const FACTORS = [
  ['weakness', 'Weakness', '30%'],
  ['importance', 'Exam importance', '25%'],
  ['urgency', 'Urgency', '20%'],
  ['difficulty', 'Difficulty', '15%'],
  ['dependency_impact', 'Dependency impact', '10%'],
]

const hoursLabel = (h) => (h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h * 60)}m`)

export default function PrioritiesPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    Promise.all([api.priorities(), api.getPlan()])
      .then(([p, plan]) => live && setData({ priorities: p.priorities, dependencies: plan?.dependencies || {} }))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [])

  if (error) return <main className="mc"><div className="errb" role="alert">{error}</div></main>
  if (!data) return <main className="mc"><Busy>Loading your priorities…</Busy></main>

  if (!data.priorities.length) {
    return (
      <main className="mc" id="main">
        <section className="card empty">
          <h2>No priorities yet</h2>
          <p>Tell Quillo what you are studying and it will rank your topics and explain why each one matters.</p>
          <Link className="bp" to="/strategy">Build my study strategy</Link>
        </section>
      </main>
    )
  }

  const total = data.priorities.reduce((s, p) => s + p.recommended_hours, 0)

  return (
    <main className="mc" id="main">
      <PageHead eyebrow="Step 2 · Prioritise" title="What to study first">
        Scores combine weakness, exam importance, urgency, difficulty and how many other topics build on each one. They are calculated, not guessed; the explanations are written by your tutor.
      </PageHead>

      <div className="ph-row">
        <span className="pill">{data.priorities.length} topics</span>
        <span className="pill">≈ {hoursLabel(total)} of study still needed</span>
        <Link className="bs" to="/plan">View study plan</Link>
      </div>

      {data.priorities.map((p, i) => {
        const tier = tierOf(p.tier)
        const needs = data.dependencies[p.topic] || []
        return (
          <article className="card pr" key={p.topic} style={{ '--i': i }}>
            <div className="pr-top">
              <span className="rank">{String(p.rank).padStart(2, '0')}</span>
              <div>
                <h3>{p.topic}</h3>
                <span className="cls" style={{ background: tier.tint, color: tier.c }}><span className="dotc" style={{ background: tier.c }}></span>{tier.label} priority</span>
              </div>
              <div className="score"><b>{p.score}</b><span>/ 100</span></div>
            </div>

            <p className="why">{p.explanation}</p>

            <div className="pr-cols">
              <div>
                <p className="lab mono">Why?</p>
                <ul className="reasons">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
              <div>
                <p className="lab mono">Score breakdown</p>
                {FACTORS.map(([key, label, weight]) => (
                  <div className="lr" key={key}>
                    <span>{label} <span style={{ color: 'var(--mu)' }}>· {weight}</span></span>
                    <span className="t" role="meter" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={p.factors[key]}><i style={{ width: `${p.factors[key]}%`, background: tier.c }}></i></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pr-foot">
              <div className="vals">
                <span className="val">Recommended: {hoursLabel(p.recommended_hours)}</span>
                <span className="val">Mastery now: {p.mastery}%</span>
                <span className="val">Difficulty {p.difficulty}/10</span>
                {needs.length > 0 && <span className="val">Needs first: {needs.join(', ')}</span>}
              </div>
              <button className="bp" type="button" onClick={() => navigate(`/learn/${encodeURIComponent(p.topic)}`)}>
                Start learning
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
              </button>
            </div>
          </article>
        )
      })}
    </main>
  )
}
