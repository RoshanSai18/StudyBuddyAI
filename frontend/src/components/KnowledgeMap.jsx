import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

// A prerequisite graph of all topics, colored by current mastery (red → amber → green).
// Fixed topological layout (no physics simulation) so it stays readable at hackathon-demo scale.
// Polls the server so it visibly recolors as mastery changes from a learning session elsewhere.

const COL_W = 190
const ROW_H = 78
const NODE_W = 160
const NODE_H = 56
const PAD = 28

function layout(nodes, edges) {
  const names = new Set(nodes.map((n) => n.topic))
  const prereqsOf = new Map(nodes.map((n) => [n.topic, []]))
  for (const e of edges) if (names.has(e.to) && names.has(e.from)) prereqsOf.get(e.to).push(e.from)

  const level = new Map()
  const levelOf = (topic, seen = new Set()) => {
    if (level.has(topic)) return level.get(topic)
    if (seen.has(topic)) return 0 // guards against any unexpected cycle; agent output is kept acyclic
    seen.add(topic)
    const prereqs = prereqsOf.get(topic) || []
    const l = prereqs.length ? 1 + Math.max(...prereqs.map((p) => levelOf(p, seen))) : 0
    level.set(topic, l)
    return l
  }
  for (const n of nodes) levelOf(n.topic)

  const byLevel = new Map()
  for (const n of nodes) {
    const l = level.get(n.topic)
    if (!byLevel.has(l)) byLevel.set(l, [])
    byLevel.get(l).push(n)
  }

  const pos = new Map()
  const maxRows = Math.max(1, ...[...byLevel.values()].map((v) => v.length))
  for (const [l, rows] of byLevel) {
    const offsetY = ((maxRows - rows.length) * ROW_H) / 2
    rows.forEach((n, i) => pos.set(n.topic, { x: PAD + l * COL_W, y: PAD + offsetY + i * ROW_H }))
  }

  const maxLevel = Math.max(0, ...[...byLevel.keys()])
  return { pos, width: PAD * 2 + maxLevel * COL_W + NODE_W, height: PAD * 2 + maxRows * ROW_H }
}

const colorFor = (mastery) => {
  const hue = Math.max(0, Math.min(100, mastery)) * 1.1 // 0 = red, 100 ≈ green
  return { fg: `hsl(${hue}, 60%, 38%)`, bg: `hsl(${hue}, 70%, 94%)`, bd: `hsl(${hue}, 55%, 68%)` }
}

export default function KnowledgeMap({ pollMs = 3000 }) {
  const [data, setData] = useState(null)
  const liveRef = useRef(true)

  useEffect(() => {
    liveRef.current = true
    const poll = () => api.knowledgeMap().then((r) => liveRef.current && setData(r)).catch(() => {})
    poll()
    const id = setInterval(poll, pollMs)
    return () => {
      liveRef.current = false
      clearInterval(id)
    }
  }, [pollMs])

  if (!data || data.nodes.length === 0) {
    return (
      <section className="card pad">
        <h2 className="h2" style={{ fontSize: 18 }}>Knowledge map</h2>
        <p className="hint">Generate a study strategy to see how your topics connect.</p>
      </section>
    )
  }

  const { nodes, edges } = data
  const { pos, width, height } = layout(nodes, edges)

  return (
    <section className="card pad kmap">
      <div className="pipeline-h">
        <h2 className="h2" style={{ fontSize: 18 }}>Knowledge map</h2>
        <span className="mono" style={{ color: 'var(--mu)' }}>Prerequisites · live mastery</span>
      </div>
      <div className="kmap-scroll">
        <svg width={width} height={height} role="img" aria-label="Topic prerequisite graph colored by mastery">
          {edges.map((e, i) => {
            const a = pos.get(e.from)
            const b = pos.get(e.to)
            if (!a || !b) return null
            const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2
            const x2 = b.x, y2 = b.y + NODE_H / 2
            const mx = (x1 + x2) / 2
            return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#d7dbef" strokeWidth="2" markerEnd="url(#kmap-arrow)" />
          })}
          <defs>
            <marker id="kmap-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#c3c9e8" />
            </marker>
          </defs>
          {nodes.map((n) => {
            const p = pos.get(n.topic)
            if (!p) return null
            const c = colorFor(n.mastery)
            return (
              <g key={n.topic} transform={`translate(${p.x},${p.y})`}>
                <rect width={NODE_W} height={NODE_H} rx="14" fill={c.bg} stroke={c.bd} strokeWidth="1.5" />
                <text x={14} y={22} fontSize="14" fontWeight="700" fill="var(--tx)" fontFamily="var(--body)">
                  {n.topic.length > 16 ? n.topic.slice(0, 15) + '…' : n.topic}
                </text>
                <text x={14} y={41} fontSize="13" fontWeight="700" fill={c.fg} fontFamily="var(--mono)">
                  {n.mastery}% mastery
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
