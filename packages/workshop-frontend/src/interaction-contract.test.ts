import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('global interactive-control contract', () => {
  it('gives enabled semantic controls a pointer without per-component classes', () => {
    expect(styles).toMatch(/button:not\(:disabled\)[\s\S]*cursor:\s*pointer/)
    expect(styles).toMatch(/a\[href\][\s\S]*cursor:\s*pointer/)
    expect(styles).toMatch(/\[role="button"\]:not\(\[aria-disabled="true"\]\)[\s\S]*cursor:\s*pointer/)
  })

  it('communicates disabled and keyboard-focus states globally', () => {
    expect(styles).toMatch(/button:disabled[\s\S]*cursor:\s*not-allowed/)
    expect(styles).toMatch(/:focus-visible[\s\S]*outline:\s*2px solid/)
  })
})
