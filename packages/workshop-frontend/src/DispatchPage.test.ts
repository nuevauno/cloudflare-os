import { describe, expect, it, vi } from 'vitest'
import { loadDispatchDocuments } from './DispatchPage'

describe('loadDispatchDocuments', () => {
  it('uses only the active authorized company', async () => {
    const getBusinessSession = vi.fn<() => Promise<never>>()
    const listDispatchDocuments = vi.fn<() => Promise<{ organizationId: string; companyId: string; documents: [] }>>().mockResolvedValue({ organizationId: 'org_rng', companyId: 'cmp_rng', documents: [] })
    const session = { actorSubject: 'piero', effectiveSubject: 'piero', activeOrganizationId: 'org_rng', activeCompanyId: 'cmp_rng', organizations: [{ id: 'org_rng', slug: 'rng', name: 'RNG', role: 'owner' as const, companies: [{ id: 'cmp_rng', organizationId: 'org_rng', slug: 'rng', legalName: 'RNG SpA', displayName: 'RNG', currencyCode: 'CLP', timezone: 'America/Santiago', status: 'active' as const, access: 'manage' as const }] }] }
    await loadDispatchDocuments({ getBusinessSession, listDispatchDocuments }, session)
    expect(getBusinessSession).not.toHaveBeenCalled()
    expect(listDispatchDocuments).toHaveBeenCalledWith('org_rng', 'cmp_rng', 100)
  })
})
