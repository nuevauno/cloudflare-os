// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { NuevaunoStatusCard } from './AdminPage'
import { RELEASE_VERSION } from './release'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('NuevaunoStatusCard', () => {
  let root: Root | undefined

  afterEach(() => act(() => root?.unmount()))

  it('shows only observed deployment facts and distinguishes verified from configured', () => {
    const container = document.createElement('div')
    root = createRoot(container)

    act(() => root!.render(
      <NuevaunoStatusCard
        origin="https://os.nuevauno.com"
        identity={{ type: 'user', id: 'felipe', name: 'Felipe' }}
        serverConfig={{
          authVendors: [],
          passwordAuthEnabled: true,
          cloudflareLimitsEnabled: false,
          signupsEnabled: false,
          siteName: 'NUEVAUNO',
          announcement: '',
          banner: '',
          bannerColor: 'neutral',
          accentColor: '#FE4A23',
        }}
        aiConfig={{ enabled: true, enabledProviders: ['cloudflare'] }}
      />,
    ))

    const text = container.textContent ?? ''
    expect(text).toContain('Estado de NUEVAUNO')
    expect(text).toContain('https://os.nuevauno.com')
    expect(text).toContain('Felipe (felipe)')
    expect(text).toContain('Contraseña')
    expect(text).toContain('cloudflare')
    expect(text).toContain('Alta de cuentas cerrada')
    expect(text).toContain(RELEASE_VERSION)
    expect(container.querySelectorAll('dd').item(1).textContent).toBe('Verificado')
    expect(container.querySelectorAll('dd').item(5).textContent).toBe('Configurado')
    expect(text).not.toMatch(/tenant|billing|facturaci[oó]n/i)
  })
})
