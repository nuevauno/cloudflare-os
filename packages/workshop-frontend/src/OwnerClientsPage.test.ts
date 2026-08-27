import { describe, expect, it } from 'vitest'
import { filterClients, groupSupportTargets } from './OwnerClientsPage'

describe('groupSupportTargets', () => {
  it('groups one SaaS client and keeps its companies separated', () => {
    const clients = groupSupportTargets([
      { subject: 'piero@demo.com', displayName: 'Piero', organizationId: 'org-piero', organizationName: 'Piero', companyId: 'rng', companyName: 'RNG' },
      { subject: 'piero@demo.com', displayName: 'Piero', organizationId: 'org-piero', organizationName: 'Piero', companyId: 'servicios', companyName: 'Servicios' },
    ])
    expect(clients).toHaveLength(1)
    expect(clients[0].displayName).toBe('Piero')
    expect(clients[0].companies.map((company) => company.name)).toEqual(['RNG', 'Servicios'])
  })

  it('finds clients by name, email, or company without rendering every record', () => {
    const clients = groupSupportTargets([
      { subject: 'piero@demo.com', displayName: 'Piero', organizationId: 'org-piero', organizationName: 'Piero', companyId: 'rng', companyName: 'RNG' },
      { subject: 'sofia@demo.com', displayName: 'Sofía', organizationId: 'org-sofia', organizationName: 'Sofía', companyId: 'salud', companyName: 'Clínica' },
    ])
    expect(filterClients(clients, 'rng').map((client) => client.displayName)).toEqual(['Piero'])
    expect(filterClients(clients, 'sofia@').map((client) => client.displayName)).toEqual(['Sofía'])
  })
})
