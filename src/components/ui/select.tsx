'use client'

import type { SelectHTMLAttributes } from 'react'

const selectClasses = 'w-full rounded-xl bg-raised border border-transparent px-3 py-2 text-ink placeholder:text-faint focus:border-amber-500 focus:outline-none'

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={className ? `${selectClasses} ${className}` : selectClasses} {...props} />
}
