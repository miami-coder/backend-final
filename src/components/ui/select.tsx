'use client'

import type { SelectHTMLAttributes } from 'react'

const selectClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-500 focus:outline-none'

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={className ? `${selectClasses} ${className}` : selectClasses} {...props} />
}
