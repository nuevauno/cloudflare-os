import { createFileRoute } from '@tanstack/react-router'
import VaultPage from '../VaultPage'

export const Route = createFileRoute('/vault')({ component: VaultPage })
