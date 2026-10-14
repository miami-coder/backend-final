'use client'

// Клікабельна (і hover-активна) ONLY кнопка: нативний <input type="file">
// прихований і не показує «Choose File / No file chosen», який реагує на
// наведення всім рядком. Вибір файлу відкриває input.click(), стан файлів
// живе в батьківській формі (onFiles), показ обраного рендерить батько.
// resetKey батько змінює після успіху — input.value очищається, щоб той
// самий файл можна було обрати повторно.

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'

type FilePickerButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'onClick'> & {
  /** Текст кнопки */
  buttonLabel: ReactNode
  /** aria-label прихованого input (скрінрідер + getByLabelText у тестах) */
  inputLabel: string
  /** id прихованого input — для <label htmlFor> */
  inputId?: string
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  /** Зміна значення очищає вибір у прихованому input */
  resetKey?: unknown
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
}

export function FilePickerButton({
  buttonLabel,
  inputLabel,
  inputId,
  accept,
  multiple = false,
  onFiles,
  resetKey,
  variant = 'secondary',
  size = 'sm',
  disabled,
  ...buttonProps
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = ''
  }, [resetKey])

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        {...buttonProps}
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </Button>
      {/* sr-only: input в a11y-дереві (label/aria-label працюють), але не
          візуальний рядок, який підсвічується при наведенні */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        aria-label={inputLabel}
        className="sr-only"
        onChange={(e) => {
          onFiles(e.target.files ? Array.from(e.target.files) : [])
        }}
      />
    </>
  )
}