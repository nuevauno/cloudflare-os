import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import PosPage from '../PosPage'

function PosRoutePage() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  return pathname === '/pos' || pathname === '/pos/' ? <PosPage /> : <Outlet />
}

export const Route = createFileRoute('/pos')({ component: PosRoutePage })
