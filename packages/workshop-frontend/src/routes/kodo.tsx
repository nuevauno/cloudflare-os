import { createFileRoute } from '@tanstack/react-router'
import KodoPage from '../KodoPage'

export const Route = createFileRoute('/kodo')({ component: KodoPage })
