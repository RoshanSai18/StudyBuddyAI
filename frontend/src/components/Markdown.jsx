import { Fragment } from 'react'

// Minimal, dependency-free renderer for lesson text: paragraphs, lists, ``` fences, **bold**, *italic*, `code`.
function inline(text) {
  const out = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g
  let last = 0
  let m
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`')) out.push(<code key={k++}>{tok.slice(1, -1)}</code>)
    else if (tok.startsWith('**')) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>)
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function blocks(text) {
  const parts = text.split(/```[^\n]*\n?/)
  const nodes = []
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      nodes.push(<pre key={`c${i}`}><code>{part.replace(/\n$/, '')}</code></pre>)
      return
    }
    part
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p, j) => {
        const lines = p.split('\n')
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          nodes.push(<ul key={`u${i}-${j}`}>{lines.map((l, n) => <li key={n}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>)
        } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          nodes.push(<ol key={`o${i}-${j}`}>{lines.map((l, n) => <li key={n}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>)
        } else {
          nodes.push(
            <p key={`p${i}-${j}`}>
              {lines.map((l, n) => (
                <Fragment key={n}>{n > 0 && <br />}{inline(l.replace(/^#+\s*/, ''))}</Fragment>
              ))}
            </p>,
          )
        }
      })
  })
  return nodes
}

export default function Markdown({ text }) {
  return <div className="md">{blocks(String(text || ''))}</div>
}
