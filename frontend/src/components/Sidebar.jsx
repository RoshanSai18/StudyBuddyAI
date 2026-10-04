import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '../auth'
import { useStudy } from '../hooks/useStudy'
import { tierOf } from '../tiers'

const svg = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

const NAV = [
  { to: '/dashboard', label: 'Home', icon: <svg {...svg}><path d="M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z"></path></svg> },
  { to: '/strategy', label: 'Study strategy', icon: <svg {...svg}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg> },
  { to: '/ask', label: 'Ask your tutor', icon: <svg {...svg}><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"></path></svg> },
  { to: '/priorities', label: 'Priorities', icon: <svg {...svg} strokeLinecap={undefined}><rect x="4" y="4" width="6.5" height="6.5" rx="1.2"></rect><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"></rect><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"></rect><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"></rect></svg>, count: true },
  { to: '/plan', label: 'Study plan', icon: <svg {...svg}><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4M16 3v4M4 10h16"></path></svg> },
  { to: '/quiz', label: 'Quiz', icon: <svg {...svg}><path d="M5 12l5 5 9-10"></path></svg> },
  { to: '/flashcards', label: 'Flashcards', icon: <svg {...svg}><rect x="5" y="7" width="13" height="9" rx="2"></rect><path d="M8 4h13a2 2 0 0 1 2 2v9"></path></svg> },
  { to: '/pipeline', label: 'Agent pipeline', icon: <svg {...svg}><circle cx="5" cy="6" r="2.4"></circle><circle cx="19" cy="6" r="2.4"></circle><circle cx="12" cy="18" r="2.4"></circle><path d="M7 7.5L12 16M17 7.5L12 16"></path></svg> },
  { to: '/demo', label: 'Run demo', icon: <svg {...svg}><path d="M6 4l14 8-14 8V4z"></path></svg> },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { priorities, xp } = useStudy()

  return (
    <aside className="sb" aria-label="Sidebar">
      <Link className="logo" to="/" aria-label="Quillo home">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9.5"></circle><path d="M20.5 20.5l6 6"></path><path d="M9 16c1.5-4.5 5-7 9-7.5"></path></svg>
        Quillo
      </Link>

      {xp && (
        <div className="xp-card" aria-label={`Level ${xp.level}, ${xp.title}, ${xp.xp_into_level} of ${xp.xp_for_next} XP to next level`}>
          <div className="xp-top">
            <span className="xp-badge">Lv {xp.level}</span>
            <div style={{ minWidth: 0 }}>
              <b>{xp.title}</b>
              <small>{xp.xp} XP total</small>
            </div>
          </div>
          <div className="xp-bar"><i style={{ width: `${xp.progress}%` }}></i></div>
          <small className="xp-next">{xp.xp_for_next - xp.xp_into_level} XP to level {xp.level + 1}</small>
        </div>
      )}

      <nav aria-label="Main">
        <ul className="nl">
          {NAV.map((n) => (
            <li key={n.to}>
              <button className="ni" type="button" aria-current={pathname === n.to ? 'page' : 'false'} onClick={() => navigate(n.to)}>
                {n.icon}{n.label}
                {n.count && priorities.length > 0 && <span className="ct">{priorities.length}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="sec-l mono">Topics</p>
      <ul className="nl">
        {priorities.map((p) => {
          const to = `/learn/${encodeURIComponent(p.topic)}`
          return (
            <li key={p.topic}>
              <button className="ni" type="button" aria-current={pathname === to ? 'page' : 'false'} onClick={() => navigate(to)}>
                <span className="dotc" style={{ background: tierOf(p.tier).c }}></span>{p.topic}
              </button>
            </li>
          )
        })}
        {priorities.length === 0 && <li><span className="sb-empty">Generate a study strategy to see your topics.</span></li>}
      </ul>
      <div className="me">
        <svg width="44" height="44" viewBox="0 0 46 46" aria-hidden="true"><rect width="46" height="46" rx="12" fill="#4f46e5"></rect><path d="M10 30c6-12 18-16 26-14-4 6-12 14-26 14z" fill="#e0e1fa"></path></svg>
        <div style={{ minWidth: 0, flex: 1 }}><b>CognitiveCrew</b><small>cognitivecrew@gmail.com</small></div>
        <Link className="ibtn" to="/" onClick={signOut} aria-label="Log out"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"></path></svg></Link>
      </div>
    </aside>
  )
}
