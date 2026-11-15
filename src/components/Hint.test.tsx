// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hint } from './Hint.tsx'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function setup() {
  render(
    <p>
      Grade <Hint note={<span>Peu difficile — a little effort</span>}>PD</Hint> <button type="button">elsewhere</button>
    </p>,
  )
  const term = screen.getByRole('button', { name: 'PD' })
  const note = document.getElementById(term.getAttribute('aria-controls')!)!
  return { term, note, root: term.parentElement! }
}

const shown = (note: HTMLElement) => !note.hidden

describe('a word with a note explaining it', () => {
  it('shows the note while the mouse is over it, and hides it again after the mouse leaves', () => {
    const { term, note, root } = setup()
    expect(shown(note)).toBe(false)
    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    act(() => void vi.advanceTimersByTime(200))
    expect(shown(note)).toBe(true)
    expect(term.getAttribute('aria-expanded')).toBe('true')
    expect(note.textContent).toContain('a little effort')
    fireEvent.pointerLeave(root, { pointerType: 'mouse' })
    act(() => void vi.advanceTimersByTime(400))
    expect(shown(note)).toBe(false)
  })

  it('lets the mouse move onto the note without it closing', () => {
    const { note, root } = setup()
    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    act(() => void vi.advanceTimersByTime(200))
    fireEvent.pointerLeave(root, { pointerType: 'mouse' })
    act(() => void vi.advanceTimersByTime(100))
    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    act(() => void vi.advanceTimersByTime(1000))
    expect(shown(note)).toBe(true)
  })

  it('opens with a tap or click, and closes with another, with Escape, or with a click elsewhere', () => {
    const { term, note } = setup()
    fireEvent.click(term)
    expect(shown(note)).toBe(true)
    fireEvent.click(term)
    expect(shown(note)).toBe(false)

    fireEvent.click(term)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(shown(note)).toBe(false)

    fireEvent.click(term)
    fireEvent.click(note)
    expect(shown(note)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(shown(note)).toBe(false)
  })

  it('opens for keyboard users as they tab onto it, and closes as they tab away', () => {
    const { term, note } = setup()
    const matches = vi.spyOn(term, 'matches').mockImplementation((s) => s === ':focus-visible')
    fireEvent.focus(term)
    expect(shown(note)).toBe(true)
    fireEvent.blur(term)
    expect(shown(note)).toBe(false)
    matches.mockRestore()
  })

  it('stays put for a touch: a tap opens it, not the touch passing over', () => {
    const { term, note, root } = setup()
    fireEvent.pointerEnter(root, { pointerType: 'touch' })
    act(() => void vi.advanceTimersByTime(500))
    expect(shown(note)).toBe(false)
    fireEvent.click(term)
    fireEvent.pointerLeave(root, { pointerType: 'touch' })
    act(() => void vi.advanceTimersByTime(500))
    expect(shown(note)).toBe(true)
  })
})
