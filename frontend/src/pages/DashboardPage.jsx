import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NotesUploadForm from '../components/NotesUploadForm'
import { TUTORS } from '../tutors'

const CLASSES = {
  phys: { name: 'Applied Physics 101', c: '#0ea5e9', tint: '#e0f2fe' },
  start: { name: 'Startup Strategy', c: '#f59e0b', tint: '#fef3c7' },
  struct: { name: 'Structural Engineering', c: '#10b981', tint: '#d1fae5' },
}
const DAY = 86400000
const LESSONS = [
  { title: 'Electricity & Magnetism', k: 'phys', pct: 86, time: '30 min', icon: 'magnet', dueIn: 1 },
  { title: 'Forces & Motion Essentials', k: 'phys', pct: 57, time: '45 min', icon: 'square', dueIn: 9, group: true },
  { title: 'Pricing Your First Product', k: 'start', pct: 42, time: '2 hrs', icon: 'bulb' },
  { title: 'Load Paths in Beams', k: 'struct', pct: 18, time: '1 hr', icon: 'beam', dueIn: 10 },
  { title: 'Running Customer Interviews', k: 'start', pct: 9, time: '1.5 hrs', icon: 'talk' },
]
const EXTRA_DUE = [
  { title: 'Lab report: magnetic fields', k: 'phys', dueIn: 2, sub: 'Upload as PDF' },
  { title: 'Pitch deck draft', k: 'start', dueIn: 4, sub: 'Group of 3' },
]
const CHATS = [
  { q: 'Why does a magnet get weaker when it heats up?', t: 0, when: '2 hours ago' },
  { q: 'My for-loop runs one time too many', t: 1, when: 'Yesterday' },
  { q: 'Is my essay intro too long?', t: 2, when: '3 days ago' },
]
const BOARD = [
  { n: 'Ella M.', c: '#2f5f78', m: 312 },
  { n: 'CognitiveCrew', c: '#4f46e5', m: 274, you: true },
  { n: 'Arjun K.', c: '#c0632c', m: 236 },
  { n: 'Mia T.', c: '#2f6b45', m: 188 },
]
const LV = ['no sessions', '1 session', '2 sessions', '3 sessions', '4+ sessions']
// 364 days of demo session levels, seeded so they never change between renders; recent days kept active for the streak
const HEAT = (() => {
  let s = 11
  const out = []
  for (let i = 0; i < 364; i++) {
    s = (s * 9301 + 49297) % 233280
    const r = s / 233280 + (i / 364) * 0.28
    let lv = r < 0.46 ? 0 : r < 0.66 ? 1 : r < 0.86 ? 2 : r < 1.06 ? 3 : 4
    if (i >= 364 - 12 && lv === 0) lv = 1
    out.push(lv)
  }
  out[364 - 13] = 0
  return out
})()
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STYLES = [
  { name: 'Seeing & Drawing', v: 85, c: '#4f46e5' },
  { name: 'Reading & Writing', v: 26, c: '#2f5f78' },
  { name: 'Speaking & Listening', v: 21, c: '#2f6b45' },
]

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const fmt = (d, o) => d.toLocaleDateString('en-GB', o)

export default function DashboardPage() {
  const navigate = useNavigate()
  const [cl, setCl] = useState(0)
  const [tu, setTu] = useState(0)
  const [cell, setCell] = useState(-1)
  const [prof, setProf] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(tick)
  }, [])

  const now = new Date(nowMs)
  const today = startOfDay(now)
  const h = now.getHours()
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const dueDate = (n) => {
    const d = new Date(today.getTime() + n * DAY)
    d.setHours(9, 0, 0, 0)
    return d
  }

  // next up = the earliest-due lesson
  const first = LESSONS[0]
  const fc = CLASSES[first.k]
  const fd = dueDate(first.dueIn)
  const ms = Math.max(0, fd - now)
  const hh = Math.floor(ms / 3600000)
  const mm = Math.floor((ms % 3600000) / 60000)
  const next = { title: first.title, cls: fc.name, c: fc.c, tint: fc.tint, pct: first.pct, time: first.time, dueLabel: fmt(fd, { weekday: 'short', day: 'numeric', month: 'short' }) + ', 09:00' }
  const countdown = hh + 'h ' + (mm < 10 ? '0' : '') + mm + 'm'

  // deadlines list (lessons with due dates + extra items), soonest first
  const dl = LESSONS.filter((l) => l.dueIn)
    .map((l) => ({ title: l.title, k: l.k, dueIn: l.dueIn, sub: 'Finish the lesson' }))
    .concat(EXTRA_DUE)
    .sort((a, b) => a.dueIn - b.dueIn)
  const weekCount = dl.filter((d) => d.dueIn <= 7).length

  // heatmap stats
  let streak = 0
  for (let i = HEAT.length - 1; i >= 0 && HEAT[i] > 0; i--) streak++
  let best = 0
  let run = 0
  HEAT.forEach((v) => {
    run = v > 0 ? run + 1 : 0
    if (run > best) best = run
  })
  const total = HEAT.reduce((a, b) => a + b, 0)
  const startDay = new Date(today.getTime() - 363 * DAY)
  const months = []
  let lastM = -1
  for (let w = 0; w < 52; w++) {
    const wd = new Date(startDay.getTime() + w * 7 * DAY)
    if (wd.getMonth() !== lastM) {
      if (w <= 49) months.push({ name: MON[wd.getMonth()], col: w + 1 })
      lastM = wd.getMonth()
    }
  }
  const cellDate = (i) => new Date(startDay.getTime() + i * DAY)

  const thenList = [
    { title: 'Physics Mentor check-in', sub: '10 min · review yesterday’s quiz', c: CLASSES.phys.c },
    { title: LESSONS[2].title, sub: 'Next section · about 25 min', c: CLASSES.start.c },
    { title: 'Flashcards: units of force', sub: '12 cards due', c: CLASSES.phys.c },
  ]

  const lessons = LESSONS.slice(cl, cl + 3).map((l) => {
    const c = CLASSES[l.k]
    return {
      title: l.title, cls: c.name, c: c.c, tint: c.tint, pct: l.pct, time: l.time, group: !!l.group,
      due: l.dueIn ? (l.dueIn === 1 ? 'Due tomorrow, 9:00' : 'Due ' + fmt(dueDate(l.dueIn), { day: 'numeric', month: 'short' })) : '',
      magnet: l.icon === 'magnet', square: l.icon === 'square', bulb: l.icon === 'bulb', beam: l.icon === 'beam', talk: l.icon === 'talk',
    }
  })
  const tutors = TUTORS.slice(tu, tu + 2)
  const deadlines = dl.slice(0, 4).map((d) => {
    const c = CLASSES[d.k]
    const dd = dueDate(d.dueIn)
    return { title: d.title, sub: c.name + ' · ' + d.sub, c: c.c, tint: c.tint, day: dd.getDate(), mon: MON[dd.getMonth()] }
  })
  const chats = CHATS.map((c) => {
    const t = TUTORS[c.t]
    return { q: c.q, who: t.name, when: c.when, c: t.c, init: t.name[0] }
  })
  const board = BOARD.map((b, i) => ({
    rank: '0' + (i + 1), name: b.you ? b.n + ' (you)' : b.n, init: b.n[0], color: b.c, w: Math.round((b.m / BOARD[0].m) * 100),
    time: Math.floor(b.m / 60) + 'h ' + (b.m % 60) + 'm', cls: b.you ? 'you' : '',
  }))

  return (
    <>
      {/* MAIN */}
      <main className="mc" id="main">
        {/* greeting band with photo */}
        <section className="card band" aria-labelledby="hi">
          <div className="band-copy">
            <span className="mono date">{fmt(now, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <h1 id="hi">{part + ', CognitiveCrew'}</h1>
            <div className="chips-row">
              <span className="pill hot"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-8.5z"></path></svg>{streak}-day streak</span>
              <span className="pill">{weekCount} things due this week</span>
            </div>
          </div>
          <div className="band-ph"><img src="/assets/bbee8eb5076cbc88531194c627249c40.jpg" alt="A student writing at a desk in front of a whiteboard" /></div>
        </section>

        {/* 1. TODAY strip */}
        <section className="card today" aria-labelledby="up-next">
          <div className="up">
            <div className="up-top">
              <span className="mono" style={{ color: 'var(--ac)' }}>Up next</span>
              <span className="cls" style={{ background: next.tint, color: next.c }}><span className="dotc" style={{ background: next.c }}></span>{next.cls}</span>
            </div>
            <h2 id="up-next">{next.title}</h2>
            <div className="count" aria-live="polite"><b>{countdown}</b><span>until it's due · {next.dueLabel}</span></div>
            <div>
              <div className="pb"><i style={{ width: `${next.pct}%`, background: next.c }}></i></div>
              <div className="meta" style={{ marginTop: '8px' }}>{next.pct}% complete<span>about {next.time} left</span></div>
            </div>
            <a className="resume" href="#lesson">Resume lesson
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
          </div>
          <div className="then">
            <span className="mono" style={{ color: 'var(--mu)' }}>Then today</span>
            {thenList.map((t) => (
              <div className="then-i" key={t.title}><span className="dotc" style={{ background: t.c }}></span><b>{t.title}</b><small>{t.sub}</small></div>
            ))}
          </div>
        </section>

        {/* 4. UPLOAD NOTES, the centre — analysis runs right here; results open on the full /notes page */}
        <section className="card ask-card" aria-labelledby="notes-h">
          <div className="ask-head">
            <h2 id="notes-h" className="h2">Upload your notes</h2>
            <span className="mono" style={{ color: 'var(--mu)' }}>PDF or text</span>
          </div>
          <p className="hint" style={{ margin: '0 0 14px' }}>Paste your notes or drop in a PDF — Quillo lays out what to study and how long each part will take.</p>
          <NotesUploadForm compact onResult={(data) => navigate('/notes', { state: { result: data } })} />
        </section>

        {/* continue learning */}
        <section aria-labelledby="cl-h">
          <div className="sh"><h2 id="cl-h" className="h2">Continue learning</h2>
            <div className="arrows">
              <button className="ibtn" type="button" aria-label="Previous lessons" aria-disabled={cl === 0 ? 'true' : 'false'} onClick={() => { if (cl > 0) setCl(cl - 1) }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg></button>
              <button className="ibtn" type="button" aria-label="Next lessons" aria-disabled={cl >= LESSONS.length - 3 ? 'true' : 'false'} onClick={() => { if (cl < LESSONS.length - 3) setCl(cl + 1) }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>
            </div>
          </div>
          <div className="cl">
            {lessons.map((l, i) => (
              <a className="cc" href="#lesson" style={{ '--i': i }} key={l.title}>
                <div className="tile" style={{ background: l.tint }}>
                  {l.due && <span className="due">{l.due}</span>}
                  {l.group && <span className="avs"><span className="av" style={{ background: '#2f5f78' }}>E</span><span className="av" style={{ background: '#c0632c' }}>A</span></span>}
                  {l.magnet && <svg width="58" height="58" viewBox="0 0 64 64" aria-hidden="true"><path d="M14 30a18 18 0 0 0 36 0V14H40v16a8 8 0 0 1-16 0V14H14z" fill="#d63a2f"></path><rect x="14" y="10" width="10" height="9" fill="#d9dde6"></rect><rect x="40" y="10" width="10" height="9" fill="#d9dde6"></rect></svg>}
                  {l.square && <svg width="58" height="58" viewBox="0 0 64 64" aria-hidden="true"><path d="M12 54V10l42 44z" fill="#6f8a9a"></path><path d="M22 44V34l10 10z" fill="#e3edf2"></path></svg>}
                  {l.bulb && <svg width="58" height="58" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="26" r="14" fill="#e9a23b"></circle><rect x="25" y="40" width="14" height="10" rx="3" fill="#8a7d70"></rect></svg>}
                  {l.beam && <svg width="58" height="58" viewBox="0 0 64 64" fill="none" stroke="#2f6b45" strokeWidth="5" strokeLinecap="round" aria-hidden="true"><path d="M8 26h48M8 36h48M14 36l8-10 8 10 8-10 8 10 8-10M14 36v16M50 36v16"></path></svg>}
                  {l.talk && <svg width="58" height="58" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 14h32a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H24l-10 8v-8h-4a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#c0632c"></path><path d="M50 26h4a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6h-2v6l-8-6H32" fill="none" stroke="#9a4f3c" strokeWidth="4"></path></svg>}
                </div>
                <span className="cls" style={{ background: l.tint, color: l.c, justifySelf: 'start' }}><span className="dotc" style={{ background: l.c }}></span>{l.cls}</span>
                <h3>{l.title}</h3>
                <div className="pb" style={{ height: '6px' }}><i style={{ width: `${l.pct}%`, background: l.c }}></i></div>
                <div className="meta">{l.pct}% complete<span>{l.time}</span></div>
              </a>
            ))}
          </div>
        </section>

        {/* tutors */}
        <section aria-labelledby="tu-h">
          <div className="sh"><h2 id="tu-h" className="h2">Tutors</h2>
            <div className="arrows">
              <button className="ibtn" type="button" aria-label="Previous tutors" aria-disabled={tu === 0 ? 'true' : 'false'} onClick={() => { if (tu > 0) setTu(tu - 2) }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg></button>
              <button className="ibtn" type="button" aria-label="Next tutors" aria-disabled={tu >= TUTORS.length - 2 ? 'true' : 'false'} onClick={() => { if (tu < TUTORS.length - 2) setTu(tu + 2) }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>
            </div>
          </div>
          <div className="tg">
            {tutors.map((t) => (
              <a className="tc" href="#tutor" key={t.name}>
                <div className="thumb"><img src={t.img} alt="" /></div>
                <div style={{ minWidth: 0 }}>
                  <h3>{t.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><span className="tag">{t.course}</span><span className="ago">· {t.ago}</span></div>
                  <p>{t.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* 2. full-year heatmap */}
        <section className="card hm-card" aria-labelledby="hm-h">
          <h2 id="hm-h" className="h2">Learning sessions</h2>
          <div className="stats">
            <div className="stat"><span className="mono">Current streak</span><b>{streak} days</b></div>
            <div className="stat"><span className="mono">Best streak</span><b>{best} days</b></div>
            <div className="stat"><span className="mono">Past 12 months</span><b>{total}</b></div>
          </div>
          <div className="hm-scroll">
            <div className="hm-in">
              <div className="months" aria-hidden="true">
                {months.map((m) => (<span key={m.col} style={{ gridColumn: `${m.col} / span 3` }}>{m.name}</span>))}
              </div>
              <div className="hm" role="group" aria-label="Study sessions per day for the past year">
                {HEAT.map((lv, i) => (
                  <button key={i} className={`cell l${lv}`} type="button" aria-label={fmt(cellDate(i), { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + LV[lv]} aria-pressed={cell === i ? 'true' : 'false'} onClick={() => setCell(i)} onMouseEnter={() => setCell(i)}></button>
                ))}
              </div>
            </div>
          </div>
          <div className="hm-foot">
            <span className="tip" aria-live="polite">{cell >= 0 ? fmt(cellDate(cell), { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + LV[HEAT[cell]] : 'Hover or tap a day to see your sessions'}</span>
            <span className="legend">Less <i className="l0"></i><i className="l1"></i><i className="l2"></i><i className="l3"></i><i className="l4"></i> More</span>
          </div>
        </section>
      </main>

      {/* 3. RIGHT PANEL: compact profile + live info */}
      <aside className="rp" aria-label="Your week">
        <section className="card prof" aria-label="Your profile">
          <div className="who">
            <svg width="56" height="56" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#4f46e5"></circle><path d="M14 44c9-18 27-24 40-21-6 9-19 21-40 21z" fill="#e0e1fa"></path></svg>
            <div style={{ minWidth: 0 }}><b>CognitiveCrew</b><span className="mono">Problem solver</span></div>
          </div>
          <button className="more" type="button" aria-expanded={prof ? 'true' : 'false'} aria-controls="prof-body" onClick={() => setProf(!prof)}>{prof ? 'Hide learning profile' : 'Show learning profile'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></button>
          {prof && (
            <div className="prof-body" id="prof-body">
              <div><p className="lab mono">Game plan</p><p className="gp">I'm aiming to <b>do well academically</b> by <b>mastering the basics</b>.</p></div>
              <div><p className="lab mono">How I like to learn</p>
                {STYLES.map((s) => (
                  <div className="lr" key={s.name}><span>{s.name}</span><span className="t" role="meter" aria-label={s.name} aria-valuemin="0" aria-valuemax="100" aria-valuenow={s.v}><i style={{ width: `${s.v}%`, background: s.c }}></i></span></div>
                ))}
              </div>
              <div><p className="lab mono">Values</p><div className="vals"><span className="val">Growth</span><span className="val">Creativity</span><span className="val">Courage</span><span className="val">Learning</span><span className="val">Excellence</span></div></div>
            </div>
          )}
        </section>

        <section className="card side-card" aria-labelledby="dl-h">
          <h2 id="dl-h" className="h2">Upcoming deadlines</h2>
          <ul className="dl">
            {deadlines.map((d) => (
              <li key={d.title}><span className="dday" style={{ background: d.tint, color: d.c }}><b>{d.day}</b><span>{d.mon}</span></span><div><b className="t">{d.title}</b><small>{d.sub}</small></div></li>
            ))}
          </ul>
        </section>

        <section className="card side-card" aria-labelledby="chat-h">
          <h2 id="chat-h" className="h2">Recent tutor chats</h2>
          {chats.map((c) => (
            <a className="ch" href="#chat" key={c.q}><span className="ico" style={{ background: c.c }}>{c.init}</span><div><span className="q">{c.q}</span><small>{c.who} · {c.when}</small></div></a>
          ))}
        </section>

        <section className="card side-card" aria-labelledby="lb-h">
          <h2 id="lb-h" className="h2">Leaderboard</h2>
          <small style={{ color: 'var(--mu)' }}>Time spent learning this week</small>
          <ol className="lb">
            {board.map((b) => (
              <li className={b.cls} key={b.name}><span className="rk mono">{b.rank}</span><span className="av" style={{ background: b.color, margin: 0 }}>{b.init}</span><div style={{ minWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div><div className="bar"><i style={{ width: `${b.w}%` }}></i></div></div><span className="mono" style={{ fontSize: '12px', color: 'var(--mu)' }}>{b.time}</span></li>
            ))}
          </ol>
        </section>
      </aside>
    </>
  )
}
