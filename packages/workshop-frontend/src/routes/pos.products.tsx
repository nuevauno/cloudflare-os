import { createFileRoute } from '@tanstack/react-router'
import PosProductsPage from '../PosProductsPage'

export const Route = createFileRoute('/pos/products')({ component: PosProductsPage })
