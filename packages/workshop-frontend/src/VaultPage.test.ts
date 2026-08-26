import { describe, expect, it, vi } from 'vitest'
import type { BusinessSessionView, VaultView } from '@gadgets/workshop-shared/api'
import { loadVault } from './VaultPage'

describe('VaultPage', () => {
  it('carga únicamente la empresa activa resuelta por el servidor', async () => {
    const result: VaultView = { organizationId: 'org_rng', companyId: 'cmp_rng', collections: [], shares: [] }
    const listVault = vi.fn<(organizationId: string, companyId: string) => Promise<VaultView>>().mockResolvedValue(result)
    const getBusinessSession = vi.fn<() => Promise<BusinessSessionView>>()
    const api = { getBusinessSession, listVault }
    const session: BusinessSessionView = {
      actorSubject: 'piero',
      effectiveSubject: 'piero',
      activeOrganizationId: 'org_rng',
      activeCompanyId: 'cmp_rng',
      organizations: [{
        id: 'org_rng',
        slug: 'piero',
        name: 'Piero',
        role: 'owner' as const,
        companies: [{
          id: 'cmp_rng',
          organizationId: 'org_rng',
          slug: 'rng',
          legalName: 'Reciclaje Norte Grande SpA',
          displayName: 'RNG',
          currencyCode: 'CLP',
          timezone: 'America/Santiago',
          status: 'migration' as const,
          access: 'manage' as const,
        }],
      }],
    }
    await loadVault(api, session)
    expect(listVault).toHaveBeenCalledWith('org_rng', 'cmp_rng')
  })
})
