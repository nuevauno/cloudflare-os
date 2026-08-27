import { createFileRoute } from '@tanstack/react-router'
import OwnerClientsPage from '../OwnerClientsPage'

export const Route = createFileRoute('/clients')({ component: OwnerClientsPage })
