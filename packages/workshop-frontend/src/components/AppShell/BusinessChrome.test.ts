import { describe, expect, it } from 'vitest'
import { companyDisplayLabel, enabledAppsForSession, SIDEBAR_UTILITY_CLASS, statusPlanLabel } from './businessChrome'

describe('NUEVAUNO business chrome', () => {
  it('keeps sidebar utilities pinned even when the support navigation is reduced', () => {
    expect(SIDEBAR_UTILITY_CLASS.split(' ')).toContain('mt-auto')
  })

  it('shows the active plan in uppercase', () => {
    expect(statusPlanLabel('Plan', 'Negocio', 'es')).toBe('PLAN NEGOCIO')
  })

  it('shows every company name in uppercase without tenant exceptions', () => {
    expect(companyDisplayLabel('Caleta Buena')).toBe('CALETA BUENA')
    expect(companyDisplayLabel('José y compañía')).toBe('JOSÉ Y COMPAÑÍA')
  })

  it('shows only apps installed for the active organization', () => {
    const baseOnly = enabledAppsForSession({ activeOrganizationId: 'base', organizations: [{ id: 'base', enabledApps: [] }] })
    const restaurant = enabledAppsForSession({ activeOrganizationId: 'restaurant', organizations: [{ id: 'base', enabledApps: [] }, { id: 'restaurant', enabledApps: ['pos', 'pos-restaurant'] }] })
    expect([...baseOnly]).toEqual([])
    expect(restaurant.has('pos')).toBe(true)
    expect(restaurant.has('pos-restaurant')).toBe(true)
    expect(restaurant.has('accounting')).toBe(false)
  })

  it('uses the organization that owns the active company as the app context', () => {
    const enabled = enabledAppsForSession({
      activeOrganizationId: 'stale-organization',
      activeCompanyId: 'restaurant-company',
      organizations: [
        { id: 'stale-organization', enabledApps: [], companies: [{ id: 'other-company' }] },
        { id: 'restaurant', enabledApps: ['pos', 'restaurant'], companies: [{ id: 'restaurant-company' }] },
      ],
    })

    expect(enabled).toEqual(new Set(['pos', 'restaurant']))
  })
})
