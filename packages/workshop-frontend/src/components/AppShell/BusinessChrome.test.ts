import { describe, expect, it } from 'vitest'
import { SIDEBAR_UTILITY_CLASS, statusPlanLabel } from './businessChrome'

describe('NUEVAUNO business chrome', () => {
  it('keeps sidebar utilities pinned even when the support navigation is reduced', () => {
    expect(SIDEBAR_UTILITY_CLASS.split(' ')).toContain('mt-auto')
  })

  it('shows the active plan in uppercase', () => {
    expect(statusPlanLabel('Plan', 'Negocio', 'es')).toBe('PLAN NEGOCIO')
  })
})
