import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '@/components/ui/toast'

function Trigger() {
  const { toast } = useToast()
  return (
    <button onClick={() => toast('Додано до обраного', 'success')}>
      Показати
    </button>
  )
}

describe('ToastProvider', () => {
  afterEach(() => vi.useRealTimers())

  it('toast() → повідомлення в aria-live region', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Показати' }))
    expect(screen.getByRole('status')).toHaveTextContent('Додано до обраного')
  })
  it('авто-зникнення через 4 с', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Показати' }))
    expect(screen.getByRole('status')).toHaveTextContent('Додано до обраного')
    // React 19: оновлення стану з-під таймера флашиться лише всередині act;
    // waitFor не працює під vitest-фейковими таймерами (інтервал ніхто не просуває)
    act(() => {
      vi.advanceTimersByTime(4500)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
