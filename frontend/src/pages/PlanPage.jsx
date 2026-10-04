import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Busy from '../components/Busy'
import PageHead from '../components/PageHead'
import PlanUpdateCard from '../components/PlanUpdateCard'
import { fmtMinutes } from '../tiers'

const TYPE_COLOR = { learn: '#9a4f3c', practice: '#c0632c', revision: '#2f5f78', break: '#b9ada0' }
const TYPE_LABEL = { learn: 'Learn', practice: 'Practice', revision: 'Revision', break: 'Break' }

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export default function PlanPage() {
  const [plan, setPlan] = useState(undefined) // undefined = loading, null = none
  const [update, setUpdate] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    try {
      const [res, ups] = await Promise.all([api.getPlan(), api.planUpdates()])
      setPlan(res ? res.plan : null)
      setUpdate(ups.updates[0] || null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const mark = async (blockId, status) => {
    try {
      await api.markBlock(blockId, status)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const replan = async () => {
    setBusy(true)
    setError('')
    setNote('')
    try {
      const res = await api.replan()
      setNote(res.updated ? 'Your plan was recalculated from your latest mastery.' : res.reason || 'Nothing needed to change.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (plan === undefined && !error) return <main className="mc"><Busy>Loading your plan…</Busy></main>

  if (plan === null) {
    return (
      <main className="mc" id="main">
        <section className="card empty">
          <h2>No study plan yet</h2>
          <p>Build your strategy first and Quillo will lay out your days.</p>
          <Link className="bp" to="/strategy">Build my study strategy</Link>
        </section>
      </main>
    )
  }
  if (!plan) return <main className="mc"><div className="errb" role="alert">{error}</div></main>

  const today = todayIso()
  const days = plan.days
  const totalMinutes = days.reduce((s, d) => s + d.totalMinutes, 0)

  return (
    <main className="mc" id="main">
      <PageHead
        eyebrow="Step 3 · Plan"
        title="Your study plan"
        actions={
          <>
            <button className="bs" type="button" disabled={busy} onClick={replan}>Replan from my progress</button>
            <Link className="bs" to="/priorities">Priorities</Link>
          </>
        }
      >
        {days.length} days until {dayLabel(plan.examDate)} · {plan.dailyHours}h a day · {fmtMinutes(totalMinutes)} of study planned. The plan changes as your mastery does.
      </PageHead>

      {busy && <Busy>Recalculating…</Busy>}
      {note && <div className="infob">{note}</div>}
      {error && <div className="errb" role="alert">{error}</div>}
      {plan.warnings?.length > 0 && <div className="errb" role="alert">{plan.warnings.join(' ')}</div>}

      <PlanUpdateCard update={update} />

      {days.map((d) => (
        <section className={`card day${d.date === today ? ' now' : ''}`} key={d.date} aria-label={dayLabel(d.date)}>
          <div className="day-h">
            <h3>Day {d.day} · {dayLabel(d.date)}{d.date === today ? ' (today)' : ''}</h3>
            <span className="mono" style={{ color: 'var(--mu)' }}>{fmtMinutes(d.totalMinutes)} of {fmtMinutes(d.capacityMinutes)}</span>
          </div>
          {d.blocks.length === 0 && <p className="hint">Nothing scheduled.</p>}
          {d.blocks.map((b) => (
            <div className={`blk ${b.status}${b.type === 'break' ? ' brk' : ''}`} key={b.id}>
              <span className="dotc" style={{ background: TYPE_COLOR[b.type] }}></span>
              <div>
                <b>{b.type === 'break' ? 'Break' : b.topic}</b>
                <small>{TYPE_LABEL[b.type]} · {fmtMinutes(b.minutes)}{b.status !== 'pending' ? ` · ${b.status}` : ''}</small>
              </div>
              {b.type !== 'break' && b.status === 'pending' && (
                <>
                  <span></span>
                  <span className="st">
                    <button className="bs sm" type="button" onClick={() => mark(b.id, 'done')}>Done</button>
                    <button className="bs sm" type="button" onClick={() => mark(b.id, 'skipped')}>Skip</button>
                  </span>
                </>
              )}
              {b.type !== 'break' && (b.status === 'done' || b.status === 'skipped') && (
                <>
                  <span className="stat-chip">{b.status}</span>
                  <span className="st"><button className="bs sm" type="button" onClick={() => mark(b.id, 'pending')}>Undo</button></span>
                </>
              )}
              {b.type !== 'break' && b.status === 'missed' && (
                <>
                  <span className="stat-chip">missed</span>
                  <span></span>
                </>
              )}
            </div>
          ))}
        </section>
      ))}
    </main>
  )
}
