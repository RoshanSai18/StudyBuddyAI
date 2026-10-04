import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import NotesUploadForm from '../components/NotesUploadForm'
import PageHead from '../components/PageHead'

const hoursLabel = (h) => (h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h * 60)}m`)

export default function NotesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Arriving from the Home page's compact upload card: the analysis already ran there, so show it
  // straight away instead of asking the student to upload the same notes twice.
  const [result, setResult] = useState(location.state?.result || null)

  const reset = () => setResult(null)

  const buildStrategy = () => {
    if (!result) return
    navigate('/strategy', {
      state: {
        prefill: {
          subject: result.subject,
          // Confidence can't be known from notes alone, so it starts neutral — the student adjusts it
          // on the Study Strategy form, same as any other topic.
          topics: result.topics.map((t) => ({ name: t.name, confidence: 5, importance: t.importance })),
        },
      },
    })
  }

  if (result) {
    return (
      <main className="mc" id="main">
        <PageHead eyebrow="Upload notes" title={result.subject}>
          {result.truncated && 'Your notes were long, so only the first part was analyzed. '}
          Here is what Quillo found.
        </PageHead>

        <section className="card notes-overview">
          <h2>Overview</h2>
          <p>{result.overview}</p>
          <div className="ph-row">
            <span className="pill">{result.topics.length} topics found</span>
            <span className="pill">≈ {hoursLabel(result.totalHours)} to review it all</span>
          </div>
        </section>

        <div className="note-grid">
          {result.topics.map((t) => (
            <article className="card note-card" key={t.name}>
              <h3>{t.name}</h3>
              <p>{t.summary}</p>
              <div className="note-tags">
                <span className="tag">Difficulty {t.difficulty}/10</span>
                <span className="tag">Importance {t.importance}/10</span>
                <span className="tag">≈ {hoursLabel(t.estimated_hours)}</span>
              </div>
            </article>
          ))}
        </div>

        <section className="card cta-card">
          <span className="mono" style={{ color: 'var(--ac)' }}>Next step</span>
          <h2>Want real help studying this?</h2>
          <p>
            Quillo can turn these {result.topics.length} topics into a full adaptive study plan — ranked by priority, scheduled around
            your exam date, and adjusted as you actually learn. You'll review and adjust everything first.
          </p>
          <div className="ph-row">
            <button className="bp" type="button" onClick={buildStrategy}>
              Build my study strategy
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
            </button>
            <button className="bs" type="button" onClick={reset}>Analyze different notes</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="mc" id="main">
      <PageHead eyebrow="Upload notes" title="Analyze your notes">
        Paste your notes or upload a PDF. Quillo reads through them and lays out what to study and roughly how long each part will take.
      </PageHead>
      <NotesUploadForm onResult={setResult} />
    </main>
  )
}
