import { describe, expect, it } from 'vitest'
import type { CommercialDocumentView } from '@gadgets/workshop-shared/api'
import { amountToMinor, dateStatus } from './CollectionsPage'

const invoice: CommercialDocumentView = {
  id: 'doc-1', organizationId: 'org-rng', companyId: 'cmp-rng', contactId: 'contact-1',
  kind: 'invoice', state: 'posted', number: 'FAC 000154', issueDate: '2026-08-01',
  dueDate: '2026-08-20', currencyCode: 'CLP', currencyExponent: 0,
  untaxedMinor: 1000, taxMinor: 190, totalMinor: 1190, residualMinor: 1190,
  paymentState: 'not_paid', contactDisplayName: 'Cliente',
}

describe('collection calculations', () => {
  it('classifies balances against an explicit business date', () => {
    expect(dateStatus(invoice, '2026-08-25')).toBe('overdue')
    expect(dateStatus({ ...invoice, dueDate: '2026-08-29' }, '2026-08-25')).toBe('dueSoon')
    expect(dateStatus({ ...invoice, dueDate: '2026-09-10' }, '2026-08-25')).toBe('current')
    expect(dateStatus({ ...invoice, residualMinor: 0, paymentState: 'paid' }, '2026-08-25')).toBe('paid')
  })

  it('converts localized decimal input to exact minor units', () => {
    expect(amountToMinor('1250', 0)).toBe(1250)
    expect(amountToMinor('12,50', 2)).toBe(1250)
    expect(amountToMinor('12.345', 2)).toBeNull()
    expect(amountToMinor('0', 0)).toBeNull()
  })
})
