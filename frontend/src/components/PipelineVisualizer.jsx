import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

// Renders the actual LangGraph node chains (planning + learning) and animates each node
// as the server reports it executing, via a short-poll of GET /api/trace. Pure visualization —
// it does not affect or read anything the agents decide, only the trace log they emit.

const PLANNING = [
  ['assessment', 'Assessment'],
  ['curriculum', 'Curriculum'],
  ['priority', 'Priority'],
  ['plan', 'Plan'],
  ['validate', 'Validate'],
  ['finalize', 'Finalize'],
]

const LEARNING = [
  ['loadTopic', 'Load topic'],
  ['determineStrategy', 'Strategy'],
  ['generateLesson', 'Lesson'],
  ['askQuestion', 'Question'],
  ['evaluate', 'Evaluate'],
]

const LEARNING_BRANCH = [
  ['increaseMastery', 'Increase mastery'],
  ['detectMisconception', 'Detect misconception'],
]

const LEARNING_TAIL = [
  ['adjustDifficulty', 'Adjust difficulty'],
  ['updateMastery', 'Update mastery'],
  ['updatePlan', 'Replan'],
]

const ACTIVE_WINDOW_MS = 4000

function Node({ id, label, latest }) {
  const ev = latest[id]
  const age = ev ? Date.now() - new Date(ev.at).getTime() : Infinity
  const status = !ev ? 'idle' : ev.status === 'active' && age < ACTIVE_WINDOW_MS ? 'active' : 'done'
  return (
    <div className={`pnode ${status}`} title={ev?.message || ''}>
      <span className="pdot" aria-hidden="true"></span>
      {label}
    </div>
  )
}

function Chain({ nodes, latest }) {
  return (
    <div className="pchain">
      {nodes.map(([id, label], i) => (
        <span key={id} style={{ display: 'contents' }}>
          <Node id={id} label={label} latest={latest} />
          {i < nodes.length - 1 && <span className="pconn" aria-hidden="true"></span>}
        </span>
      ))}
    </div>
  )
}

export default function PipelineVisualizer() {
  const [events, setEvents] = useState([])
  const liveRef = useRef(true)

  useEffect(() => {
    liveRef.current = true
    const poll = () => api.trace().then((r) => liveRef.current && setEvents(r.events)).catch(() => {})
    poll()
    const id = setInterval(poll, 800)
    return () => {
      liveRef.current = false
      clearInterval(id)
    }
  }, [])

  const latest = {}
  for (const e of events) latest[e.node] = e

  return (
    <section className="card pipeline" aria-label="Live agent pipeline">
      <div className="pipeline-h">
        <h2 className="h2" style={{ fontSize: 18 }}>Agent pipeline</h2>
        <span className="mono" style={{ color: 'var(--mu)' }}>Live</span>
      </div>

      <div className="pipeline-row">
        <span className="plab mono">Planning graph</span>
        <Chain nodes={PLANNING} latest={latest} />
      </div>

      <div className="pipeline-row">
        <span className="plab mono">Learning graph</span>
        <div className="pchain">
          {LEARNING.map(([id, label], i) => (
            <span key={id} style={{ display: 'contents' }}>
              <Node id={id} label={label} latest={latest} />
              <span className="pconn" aria-hidden="true"></span>
            </span>
          ))}
          <div className="pbranch">
            {LEARNING_BRANCH.map(([id, label]) => <Node key={id} id={id} label={label} latest={latest} />)}
          </div>
          {LEARNING_TAIL.map(([id, label]) => (
            <span key={id} style={{ display: 'contents' }}>
              <span className="pconn" aria-hidden="true"></span>
              <Node id={id} label={label} latest={latest} />
            </span>
          ))}
        </div>
      </div>

      <div className="pipeline-log" aria-label="Agent log" aria-live="polite">
        {events.length === 0 ? (
          <p className="hint">No agent activity yet. Generate a plan or answer a question to see the pipeline run.</p>
        ) : (
          <ul>
            {events.slice(-16).reverse().map((e) => (
              <li key={e.id}>
                <span className="plog-t">{new Date(e.at).toLocaleTimeString()}</span>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
