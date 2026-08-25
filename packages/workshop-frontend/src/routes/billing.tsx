import { createFileRoute } from '@tanstack/react-router'
import BillingPage from '../BillingPage'

export const Route = createFileRoute('/billing')({ component: BillingPage })
