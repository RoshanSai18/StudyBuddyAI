import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import css from '../styles/landing.css?inline'
import { useScopedStyle } from '../hooks/useScopedStyle'
import Words from '../components/Words'

const PAL = [
  { bg: '#f3e9e6', tx: '#2a1a17', ac: '#9a4f3c', ai: '#ffffff' },
  { bg: '#1f3326', tx: '#eef3ee', ac: '#a6dcb4', ai: '#10261a' },
  { bg: '#ecebea', tx: '#1d1b1a', ac: '#8a3a17', ai: '#ffffff' },
  { bg: '#f6f0f2', tx: '#24181e', ac: '#7d3f8f', ai: '#ffffff' },
  { bg: '#2b1d14', tx: '#f5ece4', ac: '#e7a86b', ai: '#2b1d14' },
  { bg: '#e8ecee', tx: '#17222a', ac: '#2f5f78', ai: '#ffffff' },
  { bg: '#140a03', tx: '#f7eadb', ac: '#f0a24a', ai: '#1a0d02' },
]
const LINKS = [
  { href: '#tutors', label: 'Tutors', sec: 1 },
  { href: '#notes', label: 'Notes', sec: 2 },
  { href: '#style', label: 'Your style', sec: 3 },
  { href: '#flow', label: 'How it flows', sec: 4 },
  { href: '#inside', label: 'Inside', sec: 5 },
  { href: '#start', label: 'Start', sec: 6 },
]
const DOTS = ['Top', 'Tutors', 'Notes', 'Your style', 'How it flows', 'Inside', 'Start']
const IDS = ['top', 'tutors', 'notes', 'style', 'flow', 'inside', 'start']
const STEPS = [
  { n: 'A', label: 'Question', text: 'You ask in your own words: typed, spoken, or as a photo of the page. Quillo restates it to make sure it heard you right.' },
  { n: 'B', label: 'Context', text: 'It pulls in your classroom, this week’s topic and your own notes, so the answer fits what you are actually studying.' },
  { n: 'C', label: 'Explanation', text: 'The explanation starts in your strongest style (a picture, a summary or an everyday example) and builds up from there.' },
  { n: 'D', label: 'Check', text: 'Two or three quick questions confirm it landed. Miss one and Quillo explains it a different way.' },
  { n: 'E', label: 'Memory', text: 'What you learned is saved to your map and scheduled for a short review before it fades.' },
]
const PHASES = ['READING', 'HIGHLIGHTING', 'EXPLAINING']

const p2 = (n) => (n < 10 ? '0' : '') + n

export default function LandingPage() {
  useScopedStyle(css)
  const [cur, setCur] = useState(0)
  const [prog, setProg] = useState(0)
  const [menu, setMenu] = useState(false)
  const [split, setSplit] = useState(50)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [stepKey, setStepKey] = useState(0)

  const live = useRef({ cur: 0, prog: 0, playing: true })
  live.current = { cur, prog, playing }
  const reduceRef = useRef(false)

  useEffect(() => {
    try {
      reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      reduceRef.current = false
    }
    const reduce = reduceRef.current
    let raf = 0
    let io = null
    let lastMag = null

    const measure = () => {
      const secs = document.querySelectorAll('[data-sec]')
      let c = 0
      const vh = window.innerHeight || 800
      secs.forEach((s, i) => {
        const r = s.getBoundingClientRect()
        if (r.top <= 81) c = i
        if (!reduce) {
          const img = s.querySelector('.plx')
          if (img && r.bottom > 0 && r.top < vh) {
            const k = (r.top + r.height / 2 - vh / 2) / (vh + r.height)
            img.style.setProperty('--p', (k * -92).toFixed(1) + 'px')
          }
        }
      })
      const de = document.scrollingElement || document.documentElement
      const max = de.scrollHeight - vh
      const pr = max > 0 ? Math.min(1, Math.max(0, de.scrollTop / max)) : 0
      if (c !== live.current.cur || Math.abs(pr - live.current.prog) > 0.002) {
        setCur(c)
        setProg(pr)
      }
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        measure()
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll)

    const els = document.querySelectorAll('[data-rv]')
    if ('IntersectionObserver' in window && !reduce) {
      io = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              e.target.setAttribute('data-in', '1')
              io.unobserve(e.target)
            }
          })
        },
        { threshold: 0.15 },
      )
      els.forEach((el) => io.observe(el))
    } else {
      els.forEach((el) => el.setAttribute('data-in', '1'))
    }

    const clock = setInterval(() => {
      setNow(Date.now())
      setTick((t) => t + 1)
    }, 1000)
    const auto = setInterval(() => {
      if (live.current.playing && !reduce) {
        setStep((s) => (s + 1) % 5)
        setStepKey((k) => k + 1)
      }
    }, 4000)

    const onMove = (e) => {
      const t = e.target && e.target.closest ? e.target : null
      const sp = t ? t.closest('.spot') : null
      if (sp) {
        const r = sp.getBoundingClientRect()
        sp.style.setProperty('--mx', e.clientX - r.left + 'px')
        sp.style.setProperty('--my', e.clientY - r.top + 'px')
      }
      const m = t ? t.closest('.mag') : null
      if (lastMag && lastMag !== m) {
        lastMag.style.setProperty('--mx2', '0px')
        lastMag.style.setProperty('--ty', '0px')
      }
      if (m && !reduce) {
        const b = m.getBoundingClientRect()
        const dx = (e.clientX - (b.left + b.width / 2)) / b.width
        const dy = (e.clientY - (b.top + b.height / 2)) / b.height
        m.style.setProperty('--mx2', (dx * 12).toFixed(1) + 'px')
        m.style.setProperty('--ty', (dy * 12).toFixed(1) + 'px')
      }
      lastMag = m
    }
    const onDown = (e) => {
      const m = e.target && e.target.closest ? e.target.closest('.btn') : null
      if (!m || reduce) return
      const b = m.getBoundingClientRect()
      m.style.setProperty('--rx', e.clientX - b.left + 'px')
      m.style.setProperty('--ry', e.clientY - b.top + 'px')
      m.removeAttribute('data-rip')
      void m.offsetWidth
      m.setAttribute('data-rip', '1')
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerdown', onDown)
    measure()

    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerdown', onDown)
      clearInterval(clock)
      clearInterval(auto)
      if (raf) cancelAnimationFrame(raf)
      if (io) io.disconnect()
    }
  }, [])

  const go = (i) => {
    const el = document.getElementById(IDS[i])
    if (el) el.scrollIntoView({ behavior: reduceRef.current ? 'auto' : 'smooth', block: 'start' })
  }

  const nav = PAL[cur]
  const d = new Date(now)
  const under = (0.78 + 0.12 * Math.abs(Math.sin(tick / 3))).toFixed(2)
  const phase = PHASES[Math.floor(tick / 2) % 3]
  const clock = p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds())
  const curStep = STEPS[step]
  const barCls = playing ? 'run k' + (stepKey % 2) : ''
  const barW = playing ? '' : (step + 1) * 20 + '%'
  const play = (
    <>
      {playing && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M8 5v14M16 5v14"></path>
        </svg>
      )}
      {!playing && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 5l12 7-12 7z"></path>
        </svg>
      )}
      {playing ? 'Pause' : 'Play'}
    </>
  )

  return (
    <div className="qx">
      <a className="skip" href="#main">Skip to content</a>

      <header className="nav" style={{ '--nbg': nav.bg, '--ntx': nav.tx, '--nac': nav.ac, '--nai': nav.ai }}>
        <div className="wrap nav-in">
          <a className="logo" href="#top" aria-label="Quillo home">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="13.5" cy="13.5" r="9.5"></circle>
              <path d="M20.5 20.5l6 6"></path>
              <path d="M9 16c1.5-4.5 5-7 9-7.5"></path>
            </svg>
            <span>Quillo</span>
          </a>
          <nav aria-label="Sections">
            <ul className="links">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} aria-current={cur === l.sec ? 'true' : 'false'}>{l.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="nav-cta">
            <Link className="btn btn-g" to="/login">Log in</Link>
            <Link className="btn btn-p mag" to="/login">Get started</Link>
            <button className="menu-btn" type="button" aria-label="Open menu" aria-expanded={menu ? 'true' : 'false'} onClick={() => setMenu((m) => !m)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16"></path>
              </svg>
            </button>
          </div>
        </div>
        <div className="prog" style={{ width: `${(prog * 100).toFixed(2)}%` }}></div>
        {menu && (
          <div className="drop">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenu(false)}>{l.label}</a>
            ))}
            <Link to="/login">Log in</Link>
          </div>
        )}
      </header>

      <div className="dots" style={{ '--nac': nav.ac }} aria-label="Jump to section">
        {DOTS.map((lab, i) => (
          <button key={lab} className="dot" type="button" aria-label={`Go to ${lab}`} aria-current={cur === i ? 'true' : 'false'} onClick={() => go(i)}>
            <span></span>
          </button>
        ))}
      </div>

      <main id="main">
        {/* 1 HERO */}
        <section id="top" className="sec s1 hero" data-sec="0" data-rv="1" data-in="1" aria-labelledby="h-hero">
          <div className="hero-copy">
            <span className="mono eyebrow rv" style={{ '--i': '0' }}>AI study companion</span>
            <h1 id="h-hero" className="h1"><Words text="Learn anything, at the pace you think." emLast /></h1>
            <p className="lede rv" style={{ '--i': '3' }}>Quillo is a patient AI tutor that <b>explains, quizzes and remembers how you learn</b>, so every study session picks up where the last one left off.</p>
            <div className="cta-row rv" style={{ '--i': '4' }}>
              <Link className="btn btn-p mag" to="/login">
                Get started
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6"></path>
                </svg>
              </Link>
              <a className="btn btn-g" href="#inside">Explore how it works</a>
            </div>
          </div>
          <div className="ph" role="img" aria-label="A student writing notes at a desk">
            <img src="/assets/bbee8eb5076cbc88531194c627249c40.jpg" alt="" />
            <div className="scan"></div>
            <div className="frame">
              <i className="c1"></i><i className="c2"></i><i className="c3"></i><i className="c4"></i>
              <span className="lab mono">Desk 01 · {phase}</span>
            </div>
            <div className="hud" aria-live="polite">
              <div className="hud-row"><span className="mono live">Live session</span><span className="v">{clock}</span></div>
              <div className="hud-row"><span className="mono k">Now</span><span className="v">{phase}</span></div>
              <div className="hud-row"><span className="mono k">Understanding</span><span className="v">{under}</span></div>
            </div>
            <span className="slot mono">Photo · 01-hero.jpg</span>
          </div>
        </section>

        {/* 2 TUTORS */}
        <section id="tutors" className="sec s2 split" data-sec="1" data-rv="1" aria-labelledby="h-tutors">
          <div className="ph" role="img" aria-label="Equations chalked on a green board">
            <img className="plx" src="/assets/1c207780c05dacf92bf0678a5bd93ca7.jpg" alt="" />
            <span className="slot mono">Photo · 02-tutors.jpg</span>
          </div>
          <div className="split-copy">
            <span className="mono eyebrow rv" style={{ '--i': '0' }}>Tutors</span>
            <h2 id="h-tutors" className="h2"><Words text="Tutors that never run out of patience." /></h2>
            <p className="lede rv" style={{ '--i': '2' }}>Each tutor is tuned to one subject and one way of teaching. Ask the same question five times and you get <b>five fresh explanations</b>, never a sigh.</p>
            <div className="tgrid">
              <article className="spot tcard rv" style={{ '--i': '3' }}>
                <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"></path></svg></div>
                <h3>Coding Tutor</h3><p>Step-by-step help that reads your code before it suggests anything.</p>
              </article>
              <article className="spot tcard rv" style={{ '--i': '4' }}>
                <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2"></circle><ellipse cx="12" cy="12" rx="9" ry="3.6"></ellipse><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"></ellipse><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"></ellipse></svg></div>
                <h3>Physics Mentor</h3><p>Connects every equation to something you can see, push or drop.</p>
              </article>
              <article className="spot tcard rv" style={{ '--i': '5' }}>
                <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></div>
                <h3>Writing Coach</h3><p>Shows you why a sentence works instead of rewriting it for you.</p>
              </article>
              <article className="spot tcard rv" style={{ '--i': '6' }}>
                <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 5h14v14H5z"></path><path d="M9 9l6 6M15 9l-6 6"></path></svg></div>
                <h3>Maths Guide</h3><p>Works through problems one move at a time and lets you take the next step.</p>
              </article>
            </div>
          </div>
        </section>

        {/* 3 NOTES (before / after) */}
        <section id="notes" className="sec s3 pad" data-sec="2" data-rv="1" aria-labelledby="h-notes">
          <div className="wrap">
            <span className="mono eyebrow rv" style={{ '--i': '0' }}>Your notes</span>
            <h2 id="h-notes" className="h2"><Words text="Bring your notes. Quillo finds the ideas inside." /></h2>
            <p className="lede rv" style={{ '--i': '2' }}>Snap a page and Quillo picks out <b>definitions, formulas and the gaps</b> you haven't filled yet. Drag the handle to compare.</p>
            <div className="ba rv" style={{ '--i': '3' }}>
              <div className="raw"><img src="/assets/3e50d05d4eb365f37849ac5031b31afa.jpg" alt="" /></div>
              <div className="ai" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
                <img src="/assets/3e50d05d4eb365f37849ac5031b31afa.jpg" alt="" />
                <div className="tint"></div>
                <div className="box" style={{ left: '26%', top: '14%', width: '30%', height: '16%' }}><span>Definition · Force</span></div>
                <div className="box" style={{ left: '62%', top: '24%', width: '24%', height: '14%' }}><span>Formula · F = ma</span></div>
                <div className="box gap" style={{ left: '55%', top: '52%', width: '32%', height: '16%' }}><span>Gap · units missing</span></div>
                <div className="box hide-s" style={{ left: '28%', top: '44%', width: '22%', height: '24%' }}><span>Worked example</span></div>
              </div>
              <span className="ba-tag mono" style={{ left: '18px' }}>Your notes</span>
              <span className="ba-tag mono" style={{ right: '18px', zIndex: 3 }}>What Quillo sees</span>
              <div className="ba-handle" style={{ left: `${split}%` }}>
                <b><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"></path></svg></b>
              </div>
              <input type="range" min="0" max="100" step="1" value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Compare your notes with what Quillo sees" />
              <span className="slot mono" style={{ zIndex: 6 }}>Photo · 03-notes.jpg</span>
            </div>
          </div>
        </section>

        {/* 4 STYLE PANEL */}
        <section id="style" className="sec s4 bgsec" data-sec="3" data-rv="1" aria-labelledby="h-style">
          <div className="ph" role="img" aria-label="Coloured pencils lined up on a white surface">
            <img className="plx" src="/assets/1574633a6e648b41ae7c481af2217bd1.jpg" alt="" />
            <span className="slot mono">Photo · 04-style.jpg</span>
          </div>
          <div className="wrap">
            <div className="panel rv" style={{ '--i': '0' }}>
              <span className="mono eyebrow">How you learn</span>
              <h2 id="h-style" className="h2"><Words text="It learns how you learn." /></h2>
              <p className="lede">After a few sessions Quillo knows whether you'd rather <b>see a diagram, read a summary or talk it through</b>, and it starts there.</p>
              <div className="term" aria-label="Learning profile loading">
                <span className="ln" style={{ '--i': '0' }}>&gt; profile.load("you")</span>
                <span className="ln" style={{ '--i': '1' }}>seeing &amp; drawing ...... <span className="ok">strong</span></span>
                <span className="ln" style={{ '--i': '2' }}>reading &amp; writing ..... building</span>
                <span className="ln" style={{ '--i': '3' }}>speaking &amp; listening .. building</span>
                <span className="ln" style={{ '--i': '4' }}>pace .................. steady</span>
                <span className="ln" style={{ '--i': '5' }}><span className="ok">next: diagram-first explanations</span><span className="caret"></span></span>
              </div>
            </div>
          </div>
        </section>

        {/* 5 WORKFLOW */}
        <section id="flow" className="sec s5 pad" data-sec="4" data-rv="1" aria-labelledby="h-flow">
          <div className="wrap">
            <span className="mono eyebrow rv" style={{ '--i': '0' }}>How it flows</span>
            <h2 id="h-flow" className="h2"><Words text="From first question to a habit." /></h2>
            <div className="ph strip rv" style={{ '--i': '1' }} role="img" aria-label="Shelves of books in an old bookshop">
              <img className="plx" src="/assets/f24128e61622260f593c160b591dccea.jpg" alt="" />
              <span className="slot mono">Photo · 05-flow.jpg</span>
            </div>
            <div className="flow">
              <p className="lede rv" style={{ '--i': '2' }}>Four steps, and you only have to remember the first one. <b>Quillo keeps track of the rest</b>: what's due, what's shaky, and what you've already nailed.</p>
              <ol className="steps">
                <li className="step"><span className="num" style={{ '--i': '0' }}>01</span><div><h3>Join a classroom</h3><p>Use your teacher's code, or start a solo space for any subject.</p></div></li>
                <li className="step"><span className="num" style={{ '--i': '1' }}>02</span><div><h3>Ask anything</h3><p>Type, talk or snap a photo of the page you're stuck on.</p></div></li>
                <li className="step"><span className="num" style={{ '--i': '2' }}>03</span><div><h3>Practise until it clicks</h3><p>Short quizzes check your understanding and loop back to the gaps.</p></div></li>
                <li className="step"><span className="num" style={{ '--i': '3' }}>04</span><div><h3>Watch your streak grow</h3><p>Every session lands on your progress map, ready for tomorrow.</p></div></li>
              </ol>
            </div>
          </div>
        </section>

        {/* 6 INSIDE */}
        <section id="inside" className="sec s6 pad" data-sec="5" data-rv="1" aria-labelledby="h-inside">
          <div className="wrap">
            <span className="mono eyebrow rv" style={{ '--i': '0' }}>Inside Quillo</span>
            <h2 id="h-inside" className="h2"><Words text="What happens after you hit ask." /></h2>
            <div className="tabs rv" style={{ '--i': '1' }} role="tablist" aria-label="Pipeline stages">
              {STEPS.map((st, i) => (
                <button key={st.n} className="tab" type="button" role="tab" aria-selected={step === i ? 'true' : 'false'} onClick={() => { setStep(i); setPlaying(false); setStepKey((k) => k + 1) }}>
                  <span className="mono">{st.n}</span>{st.label}
                </button>
              ))}
              <button className="play" type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause auto-play' : 'Resume auto-play'}>
                {play}
              </button>
            </div>
            <div className="pipe rv" style={{ '--i': '2' }}>
              <div className="stage" role="tabpanel" aria-label={curStep.label}>
                <img src="/assets/9351eed22c0de30795952e9f13c7a1ce.jpg" alt="A microscope on a lab bench" />
                <div className="ly bub">Why does a heavier object need more force to speed up?</div>
                {step >= 1 && (
                  <>
                    <div className="ly ctx" style={{ left: '8%', top: '42%', width: '28%', height: '20%' }}><span>Physics 12A · week 3</span></div>
                    <div className="ly ctx" style={{ left: '40%', top: '56%', width: '20%', height: '18%' }}><span>Your notes · p.4</span></div>
                  </>
                )}
                {step >= 2 && (
                  <div className="ly exp"><b>F = m × a.</b> Same push, more mass, so less acceleration. Picture pushing an empty trolley, then a full one.</div>
                )}
                {step >= 3 && (
                  <div className="ly chk">
                    <div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f7a4a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>Q1 · mass vs. acceleration</div>
                    <div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f7a4a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>Q2 · units of force</div>
                  </div>
                )}
                {step >= 4 && <div className="ly mem">Saved · review in 3 days</div>}
                <span className="slot mono">Photo · 06-lab.jpg</span>
              </div>
              <div className="spot desc">
                <span className="mono" style={{ color: 'var(--ac)' }}>Stage {curStep.n} of 5</span>
                <h3>{curStep.label}</h3>
                <p>{curStep.text}</p>
                <div className="bar"><i className={barCls} style={{ width: barW }}></i></div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 CTA */}
        <section id="start" className="sec s7" data-sec="6" data-rv="1" aria-labelledby="h-cta">
          <div className="cta">
            <div className="ph" role="img" aria-label="A desk at night lit by a candle, with a laptop and books">
              <img className="plx" src="/assets/adc7318cc3d84acb5a00c878c629d81a.jpg" alt="" />
              <span className="slot mono">Photo · 07-cta.jpg</span>
            </div>
            <div className="cta-panel">
              <span className="mono eyebrow rv" style={{ '--i': '0' }}>Start tonight</span>
              <h2 id="h-cta" className="h2"><Words text="Your next study session starts here." /></h2>
              <p className="lede rv" style={{ '--i': '2' }}>Join a classroom or start on your own. <b>It takes about a minute.</b></p>
              <div className="cta-row rv" style={{ '--i': '3', justifyContent: 'center' }}>
                <Link className="btn btn-p mag" to="/login">Get started</Link>
                <Link className="btn btn-g" to="/login">I already have an account</Link>
              </div>
            </div>
          </div>
          <footer className="foot">
            <div className="wrap foot-in">
              <a className="logo" href="#top"><svg width="26" height="26" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9.5"></circle><path d="M20.5 20.5l6 6"></path><path d="M9 16c1.5-4.5 5-7 9-7.5"></path></svg><span>Quillo</span></a>
              <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '22px' }}>
                <a href="#tutors">Tutors</a><a href="#notes">Notes</a><a href="#inside">How it works</a><Link to="/login">Log in</Link>
              </nav>
              <span className="mono" style={{ fontSize: '11px' }}>© 2026 Quillo</span>
            </div>
          </footer>
        </section>
      </main>
    </div>
  )
}
