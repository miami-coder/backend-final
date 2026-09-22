const DAY_LABELS: Record<string, string> = {
  mon: 'Понеділок',
  tue: 'Вівторок',
  wed: 'Середа',
  thu: 'Четвер',
  fri: 'П’ятниця', // U+2019 — типографський апостроф, уникає \'-екранування
  sat: 'Субота',
  sun: 'Неділя',
}

// Години роботи закладу: словник {mon: '10:00-22:00', …} з бекенда.
// Невідомий ключ дня показуємо як є (fallback), порожній словник → null.
export function WorkingHours({ hours }: { hours: Record<string, string> }) {
  const entries = Object.entries(hours ?? {})
  if (entries.length === 0) return null
  return (
    <dl className="space-y-1 text-sm">
      {entries.map(([day, value]) => (
        <div key={day} className="flex justify-between gap-4">
          <dt className="text-muted">{DAY_LABELS[day] ?? day}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
