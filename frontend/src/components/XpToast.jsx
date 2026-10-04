const LABELS = {
  lesson_correct_first_try: 'First try!',
  lesson_correct_after_retry: 'Got it',
  lesson_step_revisited: 'Moving on',
  lesson_complete: 'Lesson complete',
  quiz_correct: 'Correct',
  quiz_perfect_bonus: 'Perfect quiz!',
  flashcard_known: 'Card known',
}

// Small "+N XP" pills for whatever gamification/xp.js just awarded. `gains` is the xp_gained array the
// backend returns from /learning/respond, /quiz/evaluate or /flashcards/mark.
export default function XpToast({ gains }) {
  const list = (Array.isArray(gains) ? gains : [gains]).filter(Boolean)
  if (!list.length) return null
  return (
    <div className="xp-row" aria-live="polite">
      {list.map((g, i) => (
        <span className={`xp-toast${g.leveled_up ? ' level' : ''}`} key={i}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.6 6.6L22 9l-5.2 4.9L18.2 21 12 17.3 5.8 21l1.4-7.1L2 9l7.4-.4z"></path></svg>
          +{g.amount} XP · {g.leveled_up ? `Level ${g.level}!` : LABELS[g.reason] || 'Nice'}
        </span>
      ))}
    </div>
  )
}
