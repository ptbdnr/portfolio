import type { Element, ElementContent, Root } from 'hast'
import { toText } from 'hast-util-to-text'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import yamlLang from 'highlight.js/lib/languages/yaml'
import { createLowlight } from 'lowlight'
import { visit } from 'unist-util-visit'

// Only the grammars the logbook actually uses, to keep the reading bundle small.
const lowlight = createLowlight({ bash, javascript, json, python, sql, typescript, yaml: yamlLang })
lowlight.registerAlias({
  bash: ['sh', 'shell', 'zsh'],
  javascript: ['js', 'jsx'],
  typescript: ['ts', 'tsx'],
  python: ['py'],
  yaml: ['yml'],
})

/** Syntax-highlights fenced code blocks (`pre > code.language-*`) at render time. */
export default function rehypeRetroHighlight() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      if (node.tagName !== 'code' || !parent || parent.type !== 'element' || parent.tagName !== 'pre') return
      const classes = Array.isArray(node.properties.className) ? node.properties.className.map(String) : []
      const lang = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length)
      if (!lang || !lowlight.registered(lang)) return
      const result = lowlight.highlight(lang, toText(node, { whitespace: 'pre' }))
      node.properties.className = [...classes, 'hljs']
      node.children = result.children as ElementContent[]
    })
  }
}
