import { createFileRoute } from '@tanstack/react-router'
import CollectionsPage from '../CollectionsPage'

export const Route = createFileRoute('/collections')({ component: CollectionsPage })
