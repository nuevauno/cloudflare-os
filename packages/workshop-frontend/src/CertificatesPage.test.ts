import { describe, expect, it, vi } from 'vitest'
import { loadCertificates } from './CertificatesPage'

describe('loadCertificates', () => {
  it('uses the active authorized company and never accepts a browser-provided scope', async () => {
    const session = { actorSubject: 'piero', effectiveSubject: 'piero', activeOrganizationId: 'org_rng', activeCompanyId: 'cmp_rng', organizations: [{ id: 'org_rng', slug: 'rng', name: 'RNG', role: 'owner' as const, companies: [{ id: 'cmp_rng', organizationId: 'org_rng', slug: 'rng', legalName: 'RNG SpA', displayName: 'RNG', currencyCode: 'CLP', timezone: 'America/Santiago', status: 'active' as const, access: 'manage' as const }] }] }
    const listCertificates = vi.fn<() => Promise<{ organizationId: string; companyId: string; certificates: [] }>>().mockResolvedValue({ organizationId: 'org_rng', companyId: 'cmp_rng', certificates: [] })
    const getBusinessSession = vi.fn<() => Promise<typeof session>>().mockResolvedValue(session)
    await loadCertificates({ getBusinessSession, listCertificates }, session)
    expect(getBusinessSession).not.toHaveBeenCalled()
    expect(listCertificates).toHaveBeenCalledWith('org_rng', 'cmp_rng', 100)
  })
})
