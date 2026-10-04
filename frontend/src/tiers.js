// Priority tiers reuse the dashboard's own palette (accent, amber, sky, emerald).
export const TIERS = {
  critical: { label: 'Critical', c: '#4f46e5', tint: '#e0e1fa' },
  high: { label: 'High', c: '#f59e0b', tint: '#fef3c7' },
  medium: { label: 'Medium', c: '#0ea5e9', tint: '#e0f2fe' },
  low: { label: 'Low', c: '#10b981', tint: '#d1fae5' },
}

export const tierOf = (t) => TIERS[t] || TIERS.low

export function fmtMinutes(m) {
  const abs = Math.abs(Math.round(m))
  const h = Math.floor(abs / 60)
  const r = abs % 60
  return [h ? `${h}h` : '', r ? `${r}m` : ''].filter(Boolean).join(' ') || '0m'
}
