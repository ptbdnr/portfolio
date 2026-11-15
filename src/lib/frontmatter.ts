/**
 * A deliberately tiny frontmatter parser (a YAML subset) so the site doesn't ship a full YAML
 * library to every visitor. Supports: `key: value` scalars, quoted strings, numbers, booleans,
 * inline lists `[a, "b c"]`, block lists (`- item` lines) and `#` comments, on their own line or
 * after a value (as in YAML: a `#` after a space, outside quotes).
 */
export function parseFrontmatter(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const blockLists = new Set<string>()
  let listKey: string | null = null
  for (const line of text.split(/\r?\n/).map(withoutComment)) {
    if (!line.trim()) continue
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item && listKey) {
      ;(out[listKey] as unknown[]).push(scalar(item[1]))
      continue
    }
    const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!pair) continue
    const [, key, value] = pair
    listKey = null
    if (value.trim() === '') {
      out[key] = []
      listKey = key
      blockLists.add(key)
    } else if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
      out[key] = list(value.trim().slice(1, -1))
    } else {
      out[key] = scalar(value)
    }
  }
  for (const key of blockLists) if ((out[key] as unknown[]).length === 0) out[key] = ''
  return out
}

/** A line without its comment: from a `#` at the start or after a space, unless it's inside quotes. */
function withoutComment(line: string) {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const before = i === 0 ? ' ' : line[i - 1]
    if (quote) {
      if (ch === quote) quote = null
    } else if ((ch === '"' || ch === "'") && /[\s:[,]/.test(before)) {
      // A quote only opens a quoted string at the start of a value (not in "it's").
      quote = ch
    } else if (ch === '#' && /\s/.test(before)) {
      return line.slice(0, i).trimEnd()
    }
  }
  return line
}

function list(body: string): unknown[] {
  const items: string[] = []
  let current = ''
  let quote: string | null = null
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null
      current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (ch === ',') {
      items.push(current)
      current = ''
    } else current += ch
  }
  if (current.trim()) items.push(current)
  return items.map((s) => scalar(s)).filter((v) => v !== '')
}

function scalar(value: string): unknown {
  const v = value.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"')
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~') return null
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  return v
}
