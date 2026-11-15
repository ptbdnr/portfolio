export type RateLimiter = {
  /** Records a hit for `key`; returns false when the key is over its budget. */
  hit(key: string): boolean
  size(): number
}

/** Small in-memory sliding-window limiter. Good enough for a single-instance personal site. */
export function createRateLimiter(options: {
  windowMs: number
  max: number
  now?: () => number
}): RateLimiter {
  const { windowMs, max, now = Date.now } = options
  const hits = new Map<string, number[]>()
  let calls = 0

  const prune = (key: string, at: number) => {
    const recent = (hits.get(key) ?? []).filter((t) => at - t < windowMs)
    if (recent.length) hits.set(key, recent)
    else hits.delete(key)
    return recent
  }

  return {
    hit(key) {
      const at = now()
      if (++calls % 500 === 0) for (const k of [...hits.keys()]) prune(k, at)
      const recent = prune(key, at)
      if (recent.length >= max) return false
      recent.push(at)
      hits.set(key, recent)
      return true
    },
    size: () => hits.size,
  }
}
