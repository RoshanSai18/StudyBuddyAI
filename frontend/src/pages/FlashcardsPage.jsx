import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useStudy } from '../hooks/useStudy'
import Busy from '../components/Busy'
import PageHead from '../components/PageHead'
import XpToast from '../components/XpToast'
import { tierOf } from '../tiers'

function TopicPicker() {
  const navigate = useNavigate()
  const { priorities } = useStudy()
  return (
    <main className="mc" id="main">
      <PageHead eyebrow="Revise" title="Flashcards">
        Pick a topic and Quillo writes you a fresh set of cards — quick recall practice, not graded like a quiz.
      </PageHead>
      {priorities.length === 0 ? (
        <section className="card empty">
          <h2>No topics yet</h2>
          <p>Build your study strategy first and your topics will appear here.</p>
          <Link className="bp" to="/strategy">Build my study strategy</Link>
        </section>
      ) : (
        <div className="fc-pick">
          {priorities.map((p) => (
            <button type="button" key={p.topic} onClick={() => navigate(`/flashcards/${encodeURIComponent(p.topic)}`)}>
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

function Deck({ topic }) {
  const { setXp } = useStudy()
  const [deck, setDeck] = useState(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [marks, setMarks] = useState({}) // cardId -> true/false
  const [lastXp, setLastXp] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    let live = true
    setBusy(true)
    setError('')
    setDeck(null)
    setIndex(0)
    setFlipped(false)
    setMarks({})
    setLastXp(null)
    api
      .generateFlashcards(topic, 10)
      .then((d) => live && setDeck(d))
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
        <div className="ph-row"><button className="bs" type="button" onClick={load}>Try again</button><Link className="bs" to="/flashcards">Pick another topic</Link></div>
      </main>
    )
  }
  if (busy || !deck) return <main className="mc"><Busy>Writing flashcards for {topic}…</Busy></main>

  const total = deck.cards.length
  const card = deck.cards[index]
  const knownCount = Object.values(marks).filter(Boolean).length

  const mark = async (known) => {
    setMarks((m) => ({ ...m, [card.id]: known }))
    try {
      const res = await api.markFlashcard(deck.set_id, card.id, known)
      setLastXp(res.award)
      if (res.xp) setXp(res.xp)
    } catch {
      /* XP is a nice-to-have; don't block the student over it */
    }
  }

  const advance = () => {
    setFlipped(false)
    setLastXp(null)
    if (index < total - 1) setIndex((i) => i + 1)
    else setIndex(total) // past the end → summary view
  }

  if (index >= total) {
    return (
      <main className="mc" id="main">
        <PageHead eyebrow="Flashcards complete" title={topic}>
          You went through all {total} cards.
        </PageHead>
        <section className="card fc-summary">
          <div className="big">{knownCount}/{total}</div>
          <p className="hint">marked as known</p>
          <div className="ph-row">
            <button className="bp" type="button" onClick={load}>New set of cards</button>
            <Link className="bs" to={`/quiz/${encodeURIComponent(topic)}`}>Try a quiz instead</Link>
            <Link className="bs" to="/flashcards">Pick another topic</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="mc" id="main">
      <section className="card pad fc-head">
        <div>
          <span className="mono" style={{ color: 'var(--ac)' }}>Flashcards</span>
          <h1 className="h2" style={{ fontSize: 28, marginTop: 6 }}>{topic}</h1>
        </div>
        <span className="fc-progress">Card {index + 1} / {total}</span>
      </section>

      <section className="card pad fc-stage">
        <div className="pb" style={{ width: '100%', maxWidth: 560 }}><i style={{ width: `${(index / total) * 100}%`, background: 'var(--ac)' }}></i></div>

        <div className="fc-scene">
          <div className={`fc-card${flipped ? ' flipped' : ''}`} role="button" tabIndex={0} aria-label="Flip card" onClick={() => setFlipped((f) => !f)} onKeyDown={(e) => e.key === 'Enter' && setFlipped((f) => !f)}>
            <div className="fc-inner">
              <div className="fc-face fc-front">
                <span className="mono">Question</span>
                <p>{card.front}</p>
              </div>
              <div className="fc-face fc-back">
                <span className="mono">Answer</span>
                <p>{card.back}</p>
              </div>
            </div>
          </div>
        </div>
        <span className="fc-hint">{flipped ? 'Click the card to flip it back' : 'Click the card to reveal the answer'}</span>

        {lastXp && <XpToast gains={lastXp} />}

        {flipped && (
          <div className="fc-controls">
            <button className="fc-know no" type="button" aria-pressed={marks[card.id] === false ? 'true' : 'false'} onClick={() => mark(false)}>Still learning</button>
            <button className="fc-know yes" type="button" aria-pressed={marks[card.id] === true ? 'true' : 'false'} onClick={() => mark(true)}>I knew this</button>
            <button className="bp" type="button" onClick={advance}>{index < total - 1 ? 'Next card' : 'Finish'}</button>
          </div>
        )}
      </section>
    </main>
  )
}

export default function FlashcardsPage() {
  const { topic } = useParams()
  return topic ? <Deck key={topic} topic={topic} /> : <TopicPicker />
}
