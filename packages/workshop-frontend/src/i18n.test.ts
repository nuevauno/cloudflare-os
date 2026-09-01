import { describe, expect, it } from 'vitest'
import { translate } from './i18n'
import { formatDateTime, formatNumber } from './formatters'

describe('i18n', () => {
  it('defaults catalog content to Spanish and supports English', () => {
    expect(translate('es', 'home.title')).toBe('¿En qué estamos trabajando?')
    expect(translate('en', 'home.title')).toBe('What are we working on?')
  })

  it('interpolates values', () => {
    expect(translate('es', 'sidebar.showAllCount', { count: 12 })).toBe('Ver todos (12)')
  })

  it('uses task-focused language for installed business apps', () => {
    expect(translate('es', 'nav.operations')).toBe('Operaciones')
    expect(translate('es', 'sales.subtitle')).toBe('Revisa tus facturas, notas de crédito y saldos.')
    expect(translate('es', 'accounting.subtitle')).toBe('Administra tu plan de cuentas, impuestos y diarios.')
    expect(translate('es', 'sales.subtitle')).not.toContain('empresa activa')
  })

  it('centralizes locale-aware date and number formatting', () => {
    const instant = new Date('2026-08-22T15:30:00Z')
    expect(formatDateTime(instant, { language: 'es', timeZone: 'America/Santiago', hourCycle: 'h24' })).toContain('22')
    expect(formatNumber(1234.5, 'es')).not.toBe(formatNumber(1234.5, 'en'))
  })
})
