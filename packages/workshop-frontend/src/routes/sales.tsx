import { createFileRoute } from '@tanstack/react-router'
import SalesPage from '../SalesPage'

export const Route = createFileRoute('/sales')({ component: SalesPage })
