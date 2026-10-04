import { Fragment } from 'react'

// The landing page animates headlines word by word: <span class="w" style="--i:n">word</span> separated by single spaces.
export default function Words({ text, emLast = false }) {
  const words = text.split(' ')
  return words.map((w, i) => (
    <Fragment key={i}>
      {i > 0 && ' '}
      {emLast && i === words.length - 1 ? (
        <em className="w" style={{ '--i': String(i) }}>{w}</em>
      ) : (
        <span className="w" style={{ '--i': String(i) }}>{w}</span>
      )}
    </Fragment>
  ))
}
