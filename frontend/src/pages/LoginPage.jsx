import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import css from '../styles/login.css?inline'
import { useScopedStyle } from '../hooks/useScopedStyle'
import { DEMO_EMAIL, DEMO_PASSWORD, signIn } from '../auth'

const FR = {
  idle: { l: 38, t: 62, w: 58, h: 34 },
  email: { l: 42, t: 68, w: 52, h: 27 },
  pass: { l: 46, t: 72, w: 44, h: 21 },
}

export default function LoginPage() {
  useScopedStyle(css)
  const navigate = useNavigate()
  const [s, setS] = useState({ focus: 'none', email: '', pass: '', show: false, keep: true, stage: 'idle', err: '' })
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }))
  const timers = useRef([])
  const reduce = useRef(false)
  const state = useRef(s)
  state.current = s

  useEffect(() => {
    try {
      reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      reduce.current = false
    }
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const openDash = () => navigate('/dashboard')

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)
  const key = s.stage !== 'idle' ? 'pass' : s.focus === 'email' ? 'email' : s.focus === 'pass' ? 'pass' : 'idle'
  let label = 'Desk 01 · Ready'
  if (s.focus === 'email') label = valid ? 'ID matched' : 'Identifying…'
  if (s.focus === 'pass') label = 'Verifying…'
  if (s.err && s.focus === 'none') label = 'Not recognised'
  if (s.stage === 'auth') label = 'Authorizing…'
  if (s.stage === 'ok' || s.stage === 'wipe') label = 'Access granted'
  const tight = key !== 'idle'
  const fr = FR[key]
  const frameCls = (tight ? 'tight' : '') + (s.stage === 'ok' ? ' flash' : '')
  const vigCls = tight ? 'on' : ''
  const labCls =
    (s.focus === 'email' && valid) || s.stage === 'ok' || s.stage === 'wipe'
      ? 'ok'
      : s.err && s.focus === 'none'
        ? 'bad'
        : ''
  const isIdle = s.stage === 'idle'
  const isAuth = s.stage === 'auth'
  const isOk = s.stage === 'ok' || s.stage === 'wipe'
  const status = s.stage === 'auth' ? 'Authorizing' : s.stage === 'ok' ? 'Access granted' : ''

  const submit = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const cur = state.current
    if (cur.stage !== 'idle') return
    const okCreds = cur.email.trim().toLowerCase() === DEMO_EMAIL && cur.pass === DEMO_PASSWORD
    if (!okCreds) {
      set({ err: 'That email and password don’t match the demo account. Use the details above.' })
      return
    }
    signIn(cur.keep)
    if (reduce.current) {
      openDash()
      return
    }
    set({ stage: 'auth' })
    later(() => set({ stage: 'ok' }), 1300)
    later(() => set({ stage: 'wipe' }), 2100)
    later(() => openDash(), 2750)
  }

  return (
    <div className="lg">
      <div className="pic" role="img" aria-label="An open book on a sunlit windowsill">
        <img src="/assets/26c55d1c6786d4c2165cf99634d79af4.jpg" alt="" style={{ objectPosition: 'center bottom' }} />
        <div className={`vig ${vigCls}`}></div>
        <div className={`frame ${frameCls}`} style={{ left: `${fr.l}%`, top: `${fr.t}%`, width: `${fr.w}%`, height: `${fr.h}%` }}>
          <div className="sweep"></div>
          <i className="c1"></i>
          <i className="c2"></i>
          <i className="c3"></i>
          <i className="c4"></i>
          <span className={`lab mono ${labCls}`} aria-live="polite">{label}</span>
        </div>
        <Link className="chip" to="/" aria-label="Quillo home">
          <svg width="26" height="26" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="13.5" cy="13.5" r="9.5"></circle>
            <path d="M20.5 20.5l6 6"></path>
            <path d="M9 16c1.5-4.5 5-7 9-7.5"></path>
          </svg>
          Quillo
        </Link>
        <span className="slot mono">Photo · login.jpg</span>
        <div className="over">
          <b>Quillo</b>
          <p>A patient AI tutor that explains, quizzes and remembers how you learn.</p>
        </div>
      </div>

      <main className="side">
        <div className="form-wrap">
          <div>
            <span className="mono eyebrow">Study dashboard</span>
            <h1>Log in</h1>
            <p className="wel">Welcome back. Your classrooms, tutors and streak are right where you left them.</p>
          </div>
          <div className="demo">
            <div>
              <span className="mono" style={{ color: 'var(--ac)' }}>Demo account</span>
              <div className="cred">Email <code>cognitivecrew@gmail.com</code></div>
              <div className="cred">Password <code>password@123</code></div>
            </div>
            <button className="fill" type="button" onClick={() => set({ email: DEMO_EMAIL, pass: DEMO_PASSWORD, err: '' })}>Fill in</button>
          </div>
          <form onSubmit={submit} noValidate>
            <div>
              <label htmlFor="em">Email</label>
              <input id="em" className="in" type="email" autoComplete="email" placeholder="cognitivecrew@gmail.com" value={s.email} onChange={(e) => set({ email: e.target.value, err: '' })} onFocus={() => set({ focus: 'email' })} onBlur={() => set({ focus: 'none' })} />
            </div>
            <div>
              <label htmlFor="pw">Password</label>
              <div className="field">
                <input id="pw" className="in pw" type={s.show ? 'text' : 'password'} autoComplete="current-password" value={s.pass} onChange={(e) => set({ pass: e.target.value, err: '' })} onFocus={() => set({ focus: 'pass' })} onBlur={() => set({ focus: 'none' })} />
                <button className="eye" type="button" aria-label={s.show ? 'Hide password' : 'Show password'} onClick={() => set({ show: !s.show })}>{s.show ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div className="row">
              <label className="keep"><input type="checkbox" checked={s.keep} onChange={() => set({ keep: !s.keep })} />Keep me signed in</label>
              <a className="forgot" href="#forgot">Forgot password?</a>
            </div>
            <button className={`go ${isOk ? 'ok' : ''}`} type="submit" disabled={s.stage !== 'idle'}>
              {isIdle && 'Log in'}
              {isAuth && (
                <>
                  <span className="light"></span>
                  <span className="spin" aria-hidden="true"></span>Authorizing…
                </>
              )}
              {isOk && (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5 9-10"></path>
                  </svg>
                  Access granted
                </>
              )}
            </button>
            {s.err && <p className="err" role="alert">{s.err}</p>}
            <span className="sr" aria-live="polite">{status}</span>
            <p className="req">No account yet? <a href="#request">Request access</a></p>
          </form>
          <div className="inside">
            <span className="mono" style={{ color: 'var(--mu)' }}>Inside the dashboard</span>
            <ol>
              <li><span className="mono">01</span>Pick up where you left off</li>
              <li><span className="mono">02</span>Ask your tutors anything</li>
              <li><span className="mono">03</span>Test what you know</li>
              <li><span className="mono">04</span>Track your study streak</li>
            </ol>
          </div>
          <Link className="back" to="/">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6"></path>
            </svg>
            Back to home
          </Link>
          <Link id="go-dash" className="sr" to="/dashboard" tabIndex={-1} aria-hidden="true">Open dashboard</Link>
        </div>
      </main>
      <div className={`wipe ${s.stage === 'wipe' ? 'on' : ''}`}>
        <Link className="cont" to="/dashboard">Open your dashboard →</Link>
      </div>
    </div>
  )
}
