import { useRef, useState } from 'react'
import { api } from '../api/client'
import PlanningLoader from './PlanningLoader'

const NOTES_STEPS = ['Reading your notes…', 'Finding the topics…', 'Estimating difficulty & time…', 'Laying out your breakdown…']
const MAX_FILE_BYTES = 15 * 1024 * 1024
const fmtBytes = (b) => (b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)

/**
 * The paste-or-upload input form for notes analysis — shared by the Home page's compact "Upload your
 * notes" card and the full /notes page, so the validation/submit logic lives in exactly one place.
 * `onResult(data)` is called with the analysis; the parent owns what happens next (show it inline,
 * navigate to /notes with it, etc).
 */
export default function NotesUploadForm({ compact = false, onResult }) {
  const [mode, setMode] = useState('paste')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef(null)

  const pickFile = (f) => {
    if (!f) return
    if (f.type !== 'application/pdf') return setError('Only PDF files are supported — try a PDF, or paste the text instead.')
    if (f.size > MAX_FILE_BYTES) return setError('That file is too large (15MB max).')
    setError('')
    setFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'paste' && text.trim().length < 20) return setError('Add a bit more text — at least a few sentences.')
    if (mode === 'upload' && !file) return setError('Choose a PDF to upload.')

    setBusy(true)
    try {
      const data = mode === 'upload' ? await api.analyzeNotesFile(file) : await api.analyzeNotesText(text.trim())
      onResult(data)
      // intentionally leave busy=true: the parent is about to replace/navigate away from this form,
      // so staying on the loader avoids a one-frame flash of the empty form before that happens
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (busy) return <PlanningLoader title="Reading through your notes…" steps={NOTES_STEPS} />

  return (
    <form className={compact ? 'stack' : 'card pad stack'} onSubmit={submit} noValidate>
      <div className="notes-tabs" role="tablist" aria-label="How to add your notes">
        <button type="button" role="tab" aria-pressed={mode === 'paste'} onClick={() => setMode('paste')}>Paste text</button>
        <button type="button" role="tab" aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}>Upload PDF</button>
      </div>

      {mode === 'paste' ? (
        <div className="fld">
          {!compact && <label htmlFor="notes-text">Your notes</label>}
          <textarea
            id="notes-text"
            className="sb-in"
            style={{ minHeight: compact ? 110 : 260 }}
            placeholder="Paste your lecture notes, textbook summary, or revision notes here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      ) : (
        <div className="fld">
          {!file ? (
            <div
              className={`drop${dragOver ? ' drag' : ''}${compact ? ' sm' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <svg width={compact ? 24 : 32} height={compact ? 24 : 32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"></path><path d="M4 18v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path></svg>
              <b>Click to choose a PDF, or drag one here</b>
              <span>Up to 15MB</span>
              <input ref={fileInput} type="file" accept="application/pdf" onChange={(e) => pickFile(e.target.files?.[0])} />
            </div>
          ) : (
            <div className="file-chip">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"></path><path d="M14 3v5h5"></path></svg>
              <div style={{ minWidth: 0 }}>
                <b>{file.name}</b>
                <small style={{ display: 'block' }}>{fmtBytes(file.size)}</small>
              </div>
              <button className="ibtn" type="button" aria-label="Remove file" onClick={() => setFile(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div className="errb" role="alert">{error}</div>}
      <div className="ph-row">
        <button className="bp" type="submit">Analyze my notes</button>
      </div>
    </form>
  )
}
