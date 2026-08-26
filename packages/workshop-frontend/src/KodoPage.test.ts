import { describe, expect, it, vi } from 'vitest'
import { loadAgentRuns } from './KodoPage'

describe('loadAgentRuns', () => {
  it('uses only the active company authorized by the server session', async () => {
    const session = { actorSubject: 'piero', effectiveSubject: 'piero', activeOrganizationId: 'org_rng', activeCompanyId: 'cmp_rng', organizations: [{ id: 'org_rng', slug: 'rng', name: 'RNG', role: 'owner' as const, companies: [{ id: 'cmp_rng', organizationId: 'org_rng', slug: 'rng', legalName: 'RNG SpA', displayName: 'RNG', currencyCode: 'CLP', timezone: 'America/Santiago', status: 'active' as const, access: 'manage' as const }] }] }
    const listAgentRuns = vi.fn<() => Promise<{ organizationId: string; companyId: string; runs: [] }>>().mockResolvedValue({ organizationId: 'org_rng', companyId: 'cmp_rng', runs: [] })
    const getBusinessSession = vi.fn<() => Promise<typeof session>>().mockResolvedValue(session)
    await loadAgentRuns({ getBusinessSession, listAgentRuns }, session)
    expect(getBusinessSession).not.toHaveBeenCalled()
    expect(listAgentRuns).toHaveBeenCalledWith('org_rng', 'cmp_rng', 100)
  })

  it('does not query agent history without an authorized active company', async () => {
    const session = { actorSubject: 'piero', effectiveSubject: 'piero', organizations: [] }
    const listAgentRuns = vi.fn<(organizationId: string, companyId: string, limit?: number) => Promise<{ organizationId: string; companyId: string; runs: [] }>>()
    const getBusinessSession = vi.fn<() => Promise<typeof session>>()
    await expect(loadAgentRuns({ getBusinessSession, listAgentRuns }, session)).resolves.toBeNull()
    expect(listAgentRuns).not.toHaveBeenCalled()
  })
})
