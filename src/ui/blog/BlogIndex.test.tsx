// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BlogIndex } from './BlogIndex.tsx'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Address() {
  return <output data-testid="address">{useLocation().search}</output>
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <BlogIndex onClose={() => undefined} plain />
      <Address />
    </MemoryRouter>,
  )

describe('searching the blog', () => {
  it('keeps every letter typed, however fast, and puts the search in the address once typing stops', async () => {
    vi.useFakeTimers()
    renderAt('/blog')
    const input = screen.getByPlaceholderText<HTMLInputElement>('Search posts')
    for (const value of ['s', 'sa', 'san', 'sand']) fireEvent.change(input, { target: { value } })
    expect(input.value).toBe('sand')
    expect(screen.getAllByRole('article').map((a) => a.querySelector('h3')?.textContent)).toEqual(['Small rules, big avalanches'])
    expect(screen.getByTestId('address').textContent).toBe('')
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.getByTestId('address').textContent).toBe('?q=sand')
    expect(input.value).toBe('sand')
  })

  it('starts from the search in the address', () => {
    renderAt('/blog?q=calibration')
    expect(screen.getByPlaceholderText<HTMLInputElement>('Search posts').value).toBe('calibration')
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })
})
