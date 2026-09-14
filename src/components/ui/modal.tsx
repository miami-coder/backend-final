'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])'

export function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // onClose через ref: споживачі передають inline-колбекі, чиї ідентичності
  // змінюються на кожному ре-рендері батька — без ref це перезапускало б
  // ефект Escape/фокусу (фокус стрибав на тригер і повертався на перший елемент).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Початковий фокус — перший focusable контенту (не «Закрити»):
    // у формах діалогу (Tasks 12–13) фокус логічніше ставити на перше поле.
    const focusable = panelRef.current
      ? [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      : []
    const initial = focusable.find((el) => el !== closeRef.current) ?? focusable[0]
    initial?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const current = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (current.length === 0) return
      const first = current[0]
      const last = current[current.length - 1]
      // Фокус витік із панелі (клік поза контентом, вкладка браузера тощо) —
      // повертаємо всередину замість того, щоб Tab оброблявся поза діалогом
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
    // лише open: onClose іде через ref, щоб нова inline-ідентичність
    // колбека не перезапускала цей ефект під час життя діалогу
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* Заголовок і «×» — плоскі елементи панелі (без обгортки-рядка):
          кнопка закриття має бути безпосереднім сусідом контенту, щоб
          previousElementSibling у тестах указував на неї. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="pr-8 text-lg font-semibold">{title}</h2>
        <button
          ref={closeRef}
          type="button"
          aria-label="Закрити"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-ink"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  )
}
