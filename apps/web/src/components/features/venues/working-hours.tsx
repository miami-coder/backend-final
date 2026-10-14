// Форми шлють повні ключі (monday…sunday), короткі (mon…sun) — запасний
// формат від старих даних.
const DAY_LABELS: Record<string, string> = {
  monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер',
  friday: 'П’ятниця', // U+2019 — типографський апостроф, уникає \'-екранування
  saturday: 'Субота', sunday: 'Неділя',
  mon: 'Понеділок', tue: 'Вівторок', wed: 'Середа', thu: 'Четвер',
  fri: 'П’ятниця', sat: 'Субота', sun: 'Неділя',
}

// Канонічний порядок тижня: понеділок → неділя (як бекенд словник не
// повертає, наприклад {sun, sat, mon…} — сортуємо за цим списком)
const DAY_ORDER = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
]

// Години роботи закладу: словник {mon: '10:00-22:00', …} з бекенда.
// Дні стабільно впорядковані ПН-НД; невідомий ключ дня показуємо як є
// (fallback, у кінці списку), порожній словник → null.
export function WorkingHours({ hours }: { hours: Record<string, string> }) {
  const entries = Object.entries(hours ?? {})
  if (entries.length === 0) return null
  const rank = (day: string) => {
    const idx = DAY_ORDER.indexOf(day.toLowerCase())
    return idx === -1 ? DAY_ORDER.length : idx // невідомі — в кінець
  }
  return (
    <dl className="space-y-1 text-sm">
      {[...entries].sort(([a], [b]) => rank(a) - rank(b)).map(([day, value]) => (
        <div key={day} className="flex justify-between gap-4">
          <dt className="text-muted">{DAY_LABELS[day.toLowerCase()] ?? day}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
