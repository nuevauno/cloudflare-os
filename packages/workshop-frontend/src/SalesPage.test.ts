import { describe, expect, it, vi } from 'vitest'
import type { CommercialDocumentListView } from '@gadgets/workshop-shared/api'
import { loadCommercialDocuments, resolveSalesScope } from './SalesPage'

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

  it('loads the authorized company when a direct route opens before context is ready', async () => {
    const result: CommercialDocumentListView = {
      organizationId: 'org-rng',
      companyId: 'cmp-rng',
      documents: [],
    }
    const getBusinessSession = vi.fn<() => Promise<typeof session>>().mockResolvedValue(session)
    const listCommercialDocuments = vi.fn<(
      organizationId: string,
      companyId: string,
      limit?: number,
    ) => Promise<CommercialDocumentListView>>().mockResolvedValue(result)

    await expect(loadCommercialDocuments({
      getBusinessSession,
      listCommercialDocuments,
    }, null)).resolves.toBe(result)

    expect(getBusinessSession).toHaveBeenCalledOnce()
    expect(listCommercialDocuments).toHaveBeenCalledWith('org-rng', 'cmp-rng', 100)
  })
})
