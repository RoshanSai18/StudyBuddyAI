/** Pending (not yet done) study minutes per topic across the whole plan. */
export function pendingByTopic(plan) {
  const out = {};
  for (const day of plan?.days || []) {
    for (const b of day.blocks) {
      if (b.status !== 'pending' || b.type === 'break' || !b.topic) continue;
      out[b.topic] = (out[b.topic] || 0) + b.minutes;
    }
  }
  return out;
}

export function diffPlans(before, after) {
  const a = pendingByTopic(before);
  const b = pendingByTopic(after);
  const topics = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...topics]
    .map((topic) => ({
      topic,
      before_minutes: a[topic] || 0,
      after_minutes: b[topic] || 0,
      delta: (b[topic] || 0) - (a[topic] || 0),
    }))
    .filter((c) => c.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

export function fmtMinutes(m) {
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  return [h ? `${h}h` : '', r ? `${r}m` : ''].filter(Boolean).join(' ') || '0m';
}
