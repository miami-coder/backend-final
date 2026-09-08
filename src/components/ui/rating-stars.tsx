export function RatingStars({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="text-sm text-stone-400">Немає оцінок</span>
  const rounded = Math.round(value * 2) / 2
  const stars = [1, 2, 3, 4, 5]
    .map((i) => (rounded >= i ? '★' : rounded >= i - 0.5 ? '★' : '☆'))
    .join('')
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Рейтинг ${value} з 5`}>
      <span className="text-brand-500">{stars}</span>
      <span className="text-sm font-medium">{value.toFixed(1).replace('.', ',')}</span>
      {count !== undefined && <span className="text-sm text-stone-500">({count} відгуків)</span>}
    </span>
  )
}
