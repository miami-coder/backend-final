import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from '@/components/ui/modal'

describe('Modal (a11y)', () => {
  it('Escape закриває діалог', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Тест"><p>Контент</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('фокусується на першому елементі при відкритті та повертається після закриття', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Тригер'
    document.body.appendChild(trigger)
    trigger.focus()
    const { unmount } = render(
      <Modal open onClose={() => {}} title="Тест">
        <button>Перший</button>
      </Modal>,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Перший' }))
    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('Tab на останньому елементі циклічно повертається до першого', () => {
    render(
      <Modal open onClose={() => {}} title="Тест">
        <button>Один</button>
        <button>Два</button>
      </Modal>,
    )
    const [first, last] = screen.getAllByRole('button').filter((b) => b.textContent !== '×')
    // «×» (закрити) — перший focusable у панелі, тому цикл: × → Один → Два → ×
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first.previousElementSibling)
  })

  it('ре-рендер з новою inline-ідентичністю onClose не скидає фокус', () => {
    // Фокус усередині діалогу (не на першому елементі) має переживати
    // ре-рендер батька з новим inline-колбеком onClose: ефект Escape/фокусу
    // залежить лише від open, а не від ідентичності onClose.
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Тест">
        <button>Один</button>
        <button>Два</button>
      </Modal>,
    )
    const second = screen.getByRole('button', { name: 'Два' })
    second.focus()
    expect(document.activeElement).toBe(second)
    rerender(
      <Modal open onClose={() => {}} title="Тест">
        <button>Один</button>
        <button>Два</button>
      </Modal>,
    )
    // фокус НЕ стрибнув (ефект не перезапускався)
    expect(document.activeElement).toBe(second)
  })
})
