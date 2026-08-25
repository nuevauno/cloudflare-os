import { describe, expect, it } from 'vitest'
import { resolveSalesScope } from './SalesPage'

describe('resolveSalesScope', () => {
  const session = {
    actorSubject: 'piero@demo.com', effectiveSubject: 'piero@demo.com',
    organizations: [{ id: 'org-rng', slug: 'piero', name: 'Piero', role: 'owner' as const,
      companies: [{ id: 'cmp-rng', organizationId: 'org-rng', slug: 'rng', legalName: 'Reciclaje Norte Grande', displayName: 'RNG', countryCode: 'CL', currencyCode: 'CLP', timezone: 'America/Santiago', status: 'migration' as const, access: 'manage' as const }] }],
  }

  it('uses the first authorized company while no preference has been persisted', () => {
    expect(resolveSalesScope(session)).toEqual({ organizationId: 'org-rng', companyId: 'cmp-rng' })
  })

  it('uses the active authorized company when present', () => {
    expect(resolveSalesScope({ ...session, activeOrganizationId: 'org-rng', activeCompanyId: 'cmp-rng' }))
      .toEqual({ organizationId: 'org-rng', companyId: 'cmp-rng' })
  })
})
