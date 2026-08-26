// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import ReleaseVersion from './ReleaseVersion'
import { RELEASE_VERSION } from '../release'

describe('ReleaseVersion', () => {
  let root: Root | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
  })

  it('renders the single canonical release identifier', () => {
    const container = document.createElement('div')
    root = createRoot(container)
    act(() => root?.render(React.createElement(ReleaseVersion)))

    const version = container.querySelector('[data-release-version]')
    expect(version?.textContent).toBe('26.08.25.10')
    expect(version?.getAttribute('data-release-version')).toBe(RELEASE_VERSION)
    expect(version?.getAttribute('aria-label')).toBe('Versión 26.08.25.10')
  })
})
