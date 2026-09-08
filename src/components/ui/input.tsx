'use client'

import type { InputHTMLAttributes } from 'react'

const inputClasses = 'w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-500 focus:outline-none'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={className ? `${inputClasses} ${className}` : inputClasses} {...props} />
}
