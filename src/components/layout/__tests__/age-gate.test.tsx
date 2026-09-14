import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { AgeGate } from '@/components/layout/age-gate'

beforeEach(() => sessionStorage.clear())

describe('AgeGate', () => {
  it('не показується, якщо в цьому сеансі вже підтверджено', () => {
    sessionStorage.setItem('age-confirmed', '1')
    const { container } = render(<AgeGate />)
    expect(container).toBeEmptyDOMElement()
  })
  it('показує попередження і після натискання ховається і ставить прапорець', () => {
    render(<AgeGate />)
    expect(screen.getByText(/18 років/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Підтверджую/ }))
    expect(sessionStorage.getItem('age-confirmed')).toBe('1')
    expect(screen.queryByText(/18 років/)).not.toBeInTheDocument()
  })
  it('натискання «Мені немає 18» показує текст про вихід', () => {
    render(<AgeGate />)
    fireEvent.click(screen.getByRole('button', { name: /Мені немає 18/ }))
    expect(screen.getByText(/Вийдіть із застосунку/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('age-confirmed')).toBeNull()
  })
  it('діалог отримує фокус при монтуванні', () => {
    render(<AgeGate />)
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
  it('діалог отримує фокус у гідратаційному шляху першого візиту', async () => {
    // Моделюємо прод-шлях першого візиту: SSR дає getServerSnapshot()=true
    // (діалог не рендериться), після гідратації useSyncExternalStore
    // перемикається на getSnapshot()=false і діалог до-рендерюється —
    // уже ПІСЛЯ першого спрацювання ефекту. Фокус має встати саме на
    // до-рендері (залежність [confirmed]), а не на одноразовому []-ефекті.
    const container = document.createElement('div')
    document.body.appendChild(container)
    const html = renderToString(<AgeGate />)
    container.innerHTML = html
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, <AgeGate />)
      })
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
      expect(screen.getByRole('dialog')).toHaveFocus()
    } finally {
      // Прибираємо свій root навіть при фейлі, щоб залишки DOM не «текли»
      // в наступні тести (RTL cleanup прибирає лише render()-нуті root-и).
      await act(async () => {
        root?.unmount()
      })
      container.remove()
    }
  })
  it('зі стану відмови можна повернутися до підтвердження', () => {
    render(<AgeGate />)
    fireEvent.click(screen.getByRole('button', { name: /Мені немає 18/ }))
    expect(screen.getByText(/Вийдіть із застосунку/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Повернутися/ }))
    expect(screen.getByText(/18 років/)).toBeInTheDocument()
  })
})
