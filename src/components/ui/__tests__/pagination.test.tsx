import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Pagination } from '@/components/ui/pagination'

describe('Pagination', () => {
  it('одна сторінка → нічого не рендерить', () => {
    const { container } = render(<Pagination page={1} totalPages={1} hrefFor={() => '#'} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('кілька сторінок → кнопки навігації', () => {
    render(<Pagination page={2} totalPages={3} hrefFor={(p) => `/?page=${p}`} />)
    expect(screen.getByRole('link', { name: 'Попередня' })).toHaveAttribute('href', '/?page=1')
    expect(screen.getByRole('link', { name: 'Наступна' })).toHaveAttribute('href', '/?page=3')
    expect(screen.getByRole('link', { name: '1' })).toBeInTheDocument()
  })
})
