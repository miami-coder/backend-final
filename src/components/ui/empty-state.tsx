import Link from 'next/link'

// Класи — як у primary-кнопки розміру sm (кнопки тепер прямокутні, rounded-xl)
const actionClasses =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-1.5 text-[13px] font-medium text-espresso transition-colors hover:bg-amber-400'

export function EmptyState({ title, description, action }: {
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-strong bg-surface px-6 py-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className={actionClasses}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={actionClasses}>
            {action.label}
          </button>
        ))}
    </div>
  )
}
