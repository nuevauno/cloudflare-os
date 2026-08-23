import { describe, expect, it } from 'vitest'
import { resolveNuevaunoIconUrl } from './NuevaunoIcon'

describe('resolveNuevaunoIconUrl', () => {
  it('usa el SVG canónico en modo claro', () => {
    expect(resolveNuevaunoIconUrl('search', 'light'))
      .toBe('https://branding.nuevauno.com/icons/nuevauno/search.svg')
  })

  it('usa la variante blanca y naranja en modo oscuro', () => {
    expect(resolveNuevaunoIconUrl('search', 'dark'))
      .toBe('https://branding.nuevauno.com/icons/nuevauno/search-dark.svg')
  })
})
