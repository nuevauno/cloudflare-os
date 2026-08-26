import { createFileRoute } from '@tanstack/react-router'
import PublicVaultSharePage from '../PublicVaultSharePage'

export const Route = createFileRoute('/share/vault/$token')({
  component: ShareRoute,
})

function ShareRoute() {
  const { token } = Route.useParams()
  return <PublicVaultSharePage token={token} />
}
