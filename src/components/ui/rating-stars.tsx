export function RatingStars({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="text-sm text-faint">Немає оцінок</span>
  const rounded = Math.round(value * 2) / 2
  const chars = [1, 2, 3, 4, 5].map((i) => (rounded >= i ? '★' : '☆')).join('')
  // rounded кратний 0.5 — floor дає кількість повних зірок
  const filled = Math.floor(rounded)
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Рейтинг ${value} з 5`}>
      <span className="text-amber-500">{chars.slice(0, filled)}</span>
      <span className="text-strong">{chars.slice(filled)}</span>
      <span className="text-sm font-medium">{value.toFixed(1).replace('.', ',')}</span>
      {count !== undefined && <span className="text-sm text-muted">({count} відгуків)</span>}
    </span>
  )
}
