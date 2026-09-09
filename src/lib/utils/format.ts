// Формат-утиліти: спільні гроші/дати для UI (замість ad-hoc форматування).
// Виведення Intl нормалізуємо до звичайних пробілів (Intl для uk-UA
// ставить нерозривний пробіл U+00A0 перед «₴» — у UI/тестах хочемо U+0020).
function normalize(s: string): string {
  // U+00A0 прописано явно як escape \u00A0: невидимий литеральний
  // символ у regex легко пошкодити при редагуванні/копіюванні
  return s.replace(/\u00A0/gu, ' ')
}

const money = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
})

export function formatMoney(v: number | null): string {
  // null / NaN / ±Infinity: форматувати нічого (Intl дав би «∞ ₴»)
  if (v === null || !Number.isFinite(v)) return '—'
  return normalize(money.format(v))
}

const dateFmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : normalize(dateFmt.format(d))
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : normalize(dateTimeFmt.format(d))
}
