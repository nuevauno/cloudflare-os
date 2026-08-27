import { createFileRoute } from '@tanstack/react-router'
import AccountingPage from '../AccountingPage'

export const Route = createFileRoute('/accounting')({ component: AccountingPage })
