import { describe, expect, it, vi } from 'vitest'
import { loadFiscalDocuments } from './FiscalPage'

describe('fiscal company scope', () => {
  it('reads only the active authorized company', async () => {
    const listFiscalDocuments = vi.fn().mockResolvedValue({ organizationId: 'org_rng', companyId: 'cmp_rng', documents: [] })
    const api = { getBusinessSession: vi.fn(), listFiscalDocuments }
    const result = await loadFiscalDocuments(api as never, { actorSubject: 'piero', effectiveSubject: 'piero', activeOrganizationId: 'org_rng', activeCompanyId: 'cmp_rng', organizations: [{ id: 'org_rng', slug: 'rng', name: 'RNG', role: 'owner', companies: [{ id: 'cmp_rng', organizationId: 'org_rng', slug: 'rng', legalName: 'RNG', displayName: 'RNG', currencyCode: 'CLP', timezone: 'America/Santiago', status: 'migration', access: 'manage' }] }] })
    expect(listFiscalDocuments).toHaveBeenCalledWith('org_rng', 'cmp_rng', 100)
    expect(result?.companyId).toBe('cmp_rng')
  })
});
