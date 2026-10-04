const DAY_MS = 86_400_000;

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Whole days from `from` (default today) to the exam date; 0 if the exam is today or past. */
export function daysUntil(examDate, from = new Date()) {
  const diff = Math.round((parseDate(examDate) - startOfDay(from)) / DAY_MS);
  return Math.max(0, diff);
}

export const round5 = (m) => Math.max(0, Math.round(m / 5) * 5);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
