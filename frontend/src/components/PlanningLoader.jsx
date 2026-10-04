import { useEffect, useState } from 'react'

const DEFAULT_STEPS = ['Thinking…']

/**
 * A staged "AI is working" card: steps light up in sequence while the real request is in flight.
 * The pacing is cosmetic (the backend answers in one round trip, not step-by-step events) — it exists
 * so a multi-agent pipeline that takes 5-15s doesn't feel like a frozen button, and so the fact that
 * several things are genuinely happening in sequence (analyze → rank → schedule, etc.) is visible.
 */
export default function PlanningLoader({ title, steps = DEFAULT_STEPS, stepMs = 1400 }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
    if (steps.length <= 1) return undefined
    const id = setInterval(() => {
      setActive((i) => Math.min(i + 1, steps.length - 1))
    }, stepMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length, stepMs])

  return (
    <section className="card planning-loader" aria-live="polite" aria-busy="true">
      <span className="dots3" aria-hidden="true"><i></i><i></i><i></i></span>
      {title && <h2>{title}</h2>}
      <ol className="pl-steps">
        {steps.map((label, i) => (
          <li key={label} className={i < active ? 'done' : i === active ? 'current' : 'pending'}>
            <span className="pl-mark" aria-hidden="true">
              {i < active && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10"></path></svg>
              )}
              {i === active && <span className="pl-pulse" />}
            </span>
            {label}
          </li>
        ))}
      </ol>
    </section>
  )
}
