import { describe, expect, it } from 'vitest'
import { activityAppIcon } from './activityAppIcon'

describe('activityAppIcon', () => {
  it.each([
    ['pos.order.completed', 'point_of_sale'],
    ['sale.invoice.issued', 'sale'],
    ['crm.lead.created', 'crm'],
    ['contact.created', 'contacts'],
    ['kodo.task.completed', 'nuevauno_kodo'],
    ['catalog.imported', 'stock'],
    ['billing.snapshot_imported', 'nuevauno_billing'],
  ] as const)('maps %s to its canonical app icon', (activityKey, icon) => {
    expect(activityAppIcon({ activityKey, eventType: activityKey })).toBe(icon)
  })

  it('uses the NUEVAUNO app icon for a future namespace without a mapping', () => {
    expect(activityAppIcon({ activityKey: 'fleet.route.completed', eventType: 'fleet.route.completed' })).toBe('app')
  })
})
