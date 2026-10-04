// Gamification: XP and levels. Deterministic (code-owned) — the LLM never decides how much XP something
// is worth, same "LLM reasons, code decides" rule the rest of the app follows. XP lives on the in-memory
// session like everything else (no auth/DB for the MVP), and resets with the session.

export const XP_RULES = {
  lesson_correct_first_try: 12,
  lesson_correct_after_retry: 6,
  lesson_step_revisited: 2, // still rewarded for moving on, just less — don't punish struggling
  lesson_complete: 40,
  quiz_correct: 15,
  quiz_perfect_bonus: 25,
  flashcard_known: 3,
};

const XP_PER_LEVEL = 100;
const TITLES = ['Novice', 'Apprentice', 'Scholar', 'Strategist', 'Specialist', 'Expert', 'Virtuoso', 'Sage', 'Luminary', 'Grandmaster'];

export function levelFor(xp) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForNext: XP_PER_LEVEL, progress: Math.round((xpIntoLevel / XP_PER_LEVEL) * 100) };
}

export const titleFor = (level) => TITLES[Math.min(level - 1, TITLES.length - 1)];

export function initXp() {
  return { xp: 0, events: [] };
}

/** Award XP and report whether this pushed the student up a level, for a toast/badge to react to. */
export function awardXp(state, ruleKey, extraLabel) {
  const amount = XP_RULES[ruleKey];
  if (!amount) return null;
  const before = levelFor(state.xp).level;
  state.xp += amount;
  const after = levelFor(state.xp);
  const entry = {
    amount,
    reason: ruleKey,
    label: extraLabel || null,
    at: new Date().toISOString(),
    leveled_up: after.level > before,
  };
  state.events.unshift(entry);
  state.events = state.events.slice(0, 30);
  return { ...entry, xp: state.xp, level: after.level, title: titleFor(after.level) };
}

export function publicXp(state) {
  const { level, xpIntoLevel, xpForNext, progress } = levelFor(state.xp);
  return { xp: state.xp, level, title: titleFor(level), xp_into_level: xpIntoLevel, xp_for_next: xpForNext, progress, recent: state.events.slice(0, 6) };
}
