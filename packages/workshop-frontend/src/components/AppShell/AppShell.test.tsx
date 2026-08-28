// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => '/',
  useNavigate: () => vi.fn<() => void>(),
  Link: ({ children, to: _to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('../../RpcContext', () => ({ useConnectionLost: () => false }))
vi.mock('../../AuthContext', () => ({
  useAuthenticatedApi: () => ({
    businessSession: null,
    billingOverview: null,
    endSupportSession: vi.fn<() => Promise<void>>(),
  }),
}))
vi.mock('../../TopBarNotice', () => ({ default: () => null }))
vi.mock('./CommandPalette', () => ({ default: () => null }))
vi.mock('./Sidebar', () => ({
  default: () => <aside data-testid="sidebar" />,
}))

import AppShell, { isBusinessSupportRoute } from './AppShell'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('AppShell', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
  })

  it('gives the percentage-height desktop sidebar a definite-height container', () => {
    container = document.createElement('div')
    root = createRoot(container)
    act(() => root!.render(<AppShell><div /></AppShell>))

    const sidebarContainer = container.querySelector('[data-testid="sidebar"]')?.parentElement
    expect(sidebarContainer?.classList.contains('h-full')).toBe(true)
    expect(container.firstElementChild?.classList.contains('nuevauno-shell')).toBe(true)
  })

  it('keeps support inside company routes and excludes owner and personal routes', () => {
    expect(isBusinessSupportRoute('/sales')).toBe(true)
    expect(isBusinessSupportRoute('/collections')).toBe(true)
    expect(isBusinessSupportRoute('/clients')).toBe(false)
    expect(isBusinessSupportRoute('/admin')).toBe(false)
    expect(isBusinessSupportRoute('/profile')).toBe(false)
    expect(isBusinessSupportRoute('/providers')).toBe(false)
    expect(isBusinessSupportRoute('/workspaces')).toBe(false)
    expect(isBusinessSupportRoute('/')).toBe(false)
  })
})
