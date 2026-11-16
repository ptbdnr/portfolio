import type { ContactInput, ContactResponse } from '../../shared/contact.ts'
import type { StatsSnapshot } from '../../shared/sightings.ts'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

async function request<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json', ...init?.headers },
    })
    const body = (await res.json().catch(() => null)) as T | null
    if (body === null) throw new Error(`Unexpected response (${res.status})`)
    return body
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  async contact(input: ContactInput): Promise<ContactResponse> {
    return request<ContactResponse>('/api/contact', { method: 'POST', body: JSON.stringify(input) }, 15000)
  },

  async stats(): Promise<StatsSnapshot | null> {
    try {
      return await request<StatsSnapshot>('/api/stats')
    } catch {
      return null
    }
  },

  async visit(): Promise<number | null> {
    try {
      const { visitors } = await request<{ visitors: number }>('/api/stats/visit', { method: 'POST', body: '{}' })
      return typeof visitors === 'number' ? visitors : null
    } catch {
      return null
    }
  },

  /** Something spotted in the field guide, counted anonymously. */
  async sighting(spot: string): Promise<void> {
    try {
      await request('/api/stats/sighting', { method: 'POST', body: JSON.stringify({ spot }) })
    } catch {
      // Stats are a nicety.
    }
  },
}
