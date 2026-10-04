import { fmtMinutes } from '../tiers'

// "Your plan was updated": what moved, and why. Used after a lesson/quiz and on the plan page.
export default function PlanUpdateCard({ update }) {
  if (!update) return null
  const { trigger } = update
  return (
    <section className="card pu" aria-label="Plan updated">
      <span className="mono" style={{ color: 'var(--ac)' }}>✨ Your plan was updated</span>
      <h2>{update.headline}</h2>
      {trigger?.topic && trigger.mastery_from != null && (
        <p className="hint">{trigger.topic} mastery: {trigger.mastery_from}% → {trigger.mastery_to}%</p>
      )}
      <p>{update.summary}</p>
      <div>
        {update.changes.map((c) => (
          <div className="chg" key={c.topic}>
            <b>{c.topic}</b>
            <span className={`delta ${c.delta > 0 ? 'up' : 'down'}`}>{c.delta > 0 ? '+' : '−'}{fmtMinutes(c.delta)}</span>
            <small>{fmtMinutes(c.before_minutes)} → {fmtMinutes(c.after_minutes)} remaining · {c.reason}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
