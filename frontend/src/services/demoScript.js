import { api } from '../api/client'

// Drives the CLAUDE.md §31 DSA demo scenario through the REAL endpoints — nothing here is mocked.
// Each step narrates what it's about to do, calls an existing API, then yields the real response
// so the UI (and the pipeline/knowledge-map visualizers) show exactly what the server actually did.

const MCQ_WRONG_GUESS = (options) => options.length - 1
const FREE_TEXT_WRONG = "I think it just checks one neighbor and stops if it isn't the target — basically the same as a single comparison."
const MCQ_GOOD_GUESS = () => 0
const FREE_TEXT_GOOD = 'It explores every neighbor at the current distance first, visiting the graph level by level before going further.'

export async function* runDemo() {
  yield { narration: 'Resetting the agent trace for a clean run...' }
  await api.clearTrace().catch(() => {})

  yield { narration: 'Seeding the DSA demo scenario — Arrays, Linked Lists, Trees, Graphs, Dynamic Programming, Sorting — 7 days out, 3h/day...' }
  const seeded = await api.seedDemo()
  const top = seeded.priorities[0]
  yield {
    narration: top ? `Plan generated. Top priority: ${top.topic} (${top.score}/100) — ${top.reasons?.[0] || 'low confidence, high importance'}.` : 'Plan generated.',
    seeded,
  }

  yield { narration: 'Starting a learning session on Graphs...' }
  let res = await api.startLearning('Graphs', false)
  yield { narration: `Tutor chose a "${res.session.mode}" teaching strategy for Graphs.`, session: res.session }

  let session = res.session
  let q = session.question
  const wrong = q.type === 'mcq' ? MCQ_WRONG_GUESS(q.options) : FREE_TEXT_WRONG
  yield { narration: 'Submitting a deliberately weak answer, to see if the tutor catches the misconception...' }
  let ans = await api.answer(session.id, wrong, 2)
  yield {
    narration: ans.evaluation.correct
      ? `That landed correct anyway (${ans.evaluation.score}%) — advancing.`
      : `Misconception detected: "${ans.evaluation.misconception || 'a gap in understanding'}". Re-teaching with a new explanation.`,
    evaluation: ans.evaluation,
    session: ans.session,
  }

  if (!ans.evaluation.correct) {
    session = ans.session
    q = session.question
    const good = q.type === 'mcq' ? MCQ_GOOD_GUESS() : FREE_TEXT_GOOD
    yield { narration: 'Answering again now that the tutor re-taught the step...' }
    ans = await api.answer(session.id, good, 4)
    yield {
      narration: ans.evaluation.correct
        ? `Correct (${ans.evaluation.score}%). Mastery is rising.`
        : `Still short of the mark (${ans.evaluation.score}%) — the tutor will flag this for revisiting.`,
      evaluation: ans.evaluation,
      session: ans.session,
    }
  }

  yield {
    narration: ans.plan_update
      ? `Adaptive replanning kicked in: ${ans.plan_update.headline}`
      : 'Mastery saved — the schedule rebalances as more sessions come in.',
    planUpdate: ans.plan_update || null,
    mastery: ans.mastery,
    done: true,
  }
}
