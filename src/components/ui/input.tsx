'use client'

import type { InputHTMLAttributes } from 'react'

const inputClasses = 'w-full rounded-xl border border-strong bg-bg px-3 py-2 text-ink placeholder:text-faint focus:border-amber-500 focus:outline-none'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={className ? `${inputClasses} ${className}` : inputClasses} {...props} />
}
