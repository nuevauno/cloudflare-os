// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NuevaunoIdentity from './NuevaunoIdentity'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('NuevaunoIdentity', () => {
  let root: Root | undefined

  afterEach(() => {
    act(() => root?.unmount())
    vi.unstubAllGlobals()
  })

  it('derives the complete lockup geometry from the public brand spec', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      canonical: {
        cursor: {
          color: '#FE4A23', width: 0.18, height: 0.5, marginLeft: -0.06,
          cornerRadius: 0, verticalAlign: 'middle',
          blink: { duration: '1.05s', timing: 'steps(1, end)' },
        },
        lockup: {
          wordFontSizeRel: 0.78, markWordGap: 0.26,
          wordFont: 'Ubuntu Mono', wordLetterSpacing: '-0.04em',
        },
      },
    }))))
    const container = document.createElement('div')
    root = createRoot(container)

    await act(async () => root!.render(<NuevaunoIdentity siteName="NUEVAUNO OS" size={56} showOs={false} />))

    const lockup = container.firstElementChild as HTMLElement
    const wordmark = container.querySelector('.font-nuevauno') as HTMLElement
    const cursor = container.querySelector('.nuevauno-cursor') as HTMLElement
    expect(lockup.style.gap).toBe('14.56px')
    expect(wordmark.style.fontSize).toBe('43.68px')
    expect(wordmark.style.letterSpacing).toBe('-0.04em')
    expect(cursor.style.width).toBe(`${0.18 / 0.78}em`)
    expect(cursor.style.height).toBe(`${0.5 / 0.78}em`)
    expect(cursor.style.marginLeft).toBe(`${(0.26 - 0.06) / 0.78}em`)
    expect(container.textContent).toBe('nuevauno')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://branding.nuevauno.com/logos/nuevauno-mark.svg')
  })
})
