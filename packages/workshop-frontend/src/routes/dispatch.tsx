import { createFileRoute } from '@tanstack/react-router'
import DispatchPage from '../DispatchPage'

export const Route = createFileRoute('/dispatch')({ component: DispatchPage })
