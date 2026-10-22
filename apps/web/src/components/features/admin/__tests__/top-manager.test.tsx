import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { TopManager } from '@/components/features/admin/top-manager'
import type { TopCategoryAdmin } from '@/services/venues'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const addTopEntry = vi.fn()
const createTopCategory = vi.fn()
const deleteTopCategory = vi.fn()
const removeTopEntry = vi.fn()
const reorderTopEntries = vi.fn()
vi.mock('@/services/venues', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/venues')>()),
  addTopEntry: (...a: unknown[]) => addTopEntry(...a),
  createTopCategory: (...a: unknown[]) => createTopCategory(...a),
  deleteTopCategory: (...a: unknown[]) => deleteTopCategory(...a),
  removeTopEntry: (...a: unknown[]) => removeTopEntry(...a),
  reorderTopEntries: (...a: unknown[]) => reorderTopEntries(...a),
}))

afterEach(() => {
  addTopEntry.mockReset()
  createTopCategory.mockReset()
  deleteTopCategory.mockReset()
  removeTopEntry.mockReset()
  reorderTopEntries.mockReset()
  refresh.mockReset()
})

const entries2 = [
  { id: 'e1', venueId: 'v-1', position: 0, venue: { name: 'Караоке «Кеш&Cash»' } },
  { id: 'e2', venueId: 'v-2', position: 1, venue: { name: 'Паб «Union Jack»' } },
]

function renderTwoEntries() {
  return render(
    <ToastProvider>
      <TopManager
        categories={[{ ...makeCategory(entries2 as TopCategoryAdmin['entries']) }]}
        venues={venueOptions}
      />
    </ToastProvider>,
  )
}

const venueOptions = [
  { id: 'v-1', name: 'Караоке «Кеш&Cash»' },
  { id: 'v-2', name: 'Паб «Union Jack»' },
]

function makeCategory(entries: TopCategoryAdmin['entries'] = []): TopCategoryAdmin {
  return {
    id: 'c1',
    title: 'Заклад для тусовки',
    position: 0,
    entries,
  } as TopCategoryAdmin
}

function renderForm(venues = venueOptions) {
  return render(
    <ToastProvider>
      <TopManager categories={[makeCategory()]} venues={venues} />
    </ToastProvider>,
  )
}

describe('TopManager', () => {
  it('вибір закладу для категорії — <select> з назвами, не текстовий інпут UUID', () => {
    renderForm()
    const select = screen.getByRole('combobox', {
      name: 'Заклад для категорії Заклад для тусовки',
    })
    expect(select.tagName).toBe('SELECT')
    expect(screen.queryByRole('textbox', { name: /UUID/i })).toBeNull()
    const options = Array.from((select as HTMLSelectElement).options).map(
      (o) => o.textContent,
    )
    // плейсхолдер + всі заклади за назвою (айді — лише як value)
    expect(options[0]).toContain('Оберіть заклад')
    expect(options).toContain('Караоке «Кеш&Cash»')
    expect(options).toContain('Паб «Union Jack»')
    expect((select as HTMLSelectElement).options[1].value).toBe('v-1')
  })

  it('вибраний заклад + submit → addTopEntry(c1, v-1); поле скидання на оберіть заклад', async () => {
    addTopEntry.mockResolvedValue({})
    renderForm()
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Заклад для категорії Заклад для тусовки',
      }),
      { target: { value: 'v-1' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Додати в Топ' }))
    await waitFor(() => expect(addTopEntry).toHaveBeenCalledWith('c1', 'v-1'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const select = screen.getByRole('combobox', {
      name: 'Заклад для категорії Заклад для тусовки',
    }) as HTMLSelectElement
    expect(select).toHaveValue('')
  })

  it('порожній <select> (плейсхолдер) + submit → addTopEntry не викликається', async () => {
    addTopEntry.mockResolvedValue({})
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Додати в Топ' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Оберіть заклад'))
    expect(addTopEntry).not.toHaveBeenCalled()
  })

  it('список закладів порожній → select показує «Немає закладів» і submit нічого не шле', async () => {
    addTopEntry.mockResolvedValue({})
    renderForm([])
    const select = screen.getByRole('combobox', {
      name: 'Заклад для категорії Заклад для тусовки',
    })
    Array.from((select as HTMLSelectElement).options).forEach((o) =>
      expect(o.disabled).toBe(true),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Додати в Топ' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Закладів ще нема'))
    expect(addTopEntry).not.toHaveBeenCalled()
  })

  it('↑ підняти другий запис → reorderTopEntries(c1, [e2, e1]) + refresh', async () => {
    reorderTopEntries.mockResolvedValue({})
    renderTwoEntries()
    // у записів дві кнопки: «Вгору» і «Вниз»; перший запис — «Вгору» недоступна
    const upButtons = screen.getAllByRole('button', { name: 'Вгору' })
    expect(upButtons[0]).toBeDisabled()
    expect(upButtons[1]).toBeEnabled()
    fireEvent.click(upButtons[1])
    await waitFor(() => expect(reorderTopEntries).toHaveBeenCalledWith('c1', ['e2', 'e1']))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('↓ опустити перший запис → reorderTopEntries(c1, [e2, e1]); «Вниз» останнього — недоступна', async () => {
    reorderTopEntries.mockResolvedValue({})
    renderTwoEntries()
    const downButtons = screen.getAllByRole('button', { name: 'Вниз' })
    expect(downButtons[1]).toBeDisabled()
    fireEvent.click(downButtons[0])
    await waitFor(() => expect(reorderTopEntries).toHaveBeenCalledWith('c1', ['e2', 'e1']))
  })
})