import { createFileRoute } from '@tanstack/react-router'
import CertificatesPage from '../CertificatesPage'

export const Route = createFileRoute('/certificates')({ component: CertificatesPage })
