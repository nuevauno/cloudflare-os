import { useEffect, useState } from 'react'
import type { AuthenticatedApi, BusinessSessionView, CertificateListView, CertificateView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import { resolveSalesScope } from './SalesPage'
import NuevaunoIcon from './components/NuevaunoIcon'

/** Loads certificates only after resolving an authorized company on the server session. */
export async function loadCertificates(
  authenticatedApi: Pick<AuthenticatedApi, 'getBusinessSession' | 'listCertificates'>,
  session: BusinessSessionView | null,
): Promise<CertificateListView | null> {
  const resolvedSession = session ?? await authenticatedApi.getBusinessSession()
  const scope = resolveSalesScope(resolvedSession)
  if (!scope) return null
  return authenticatedApi.listCertificates(scope.organizationId, scope.companyId, 100)
}

const stateKey: Record<CertificateView['state'], 'certificates.state.draft' | 'certificates.state.issued' | 'certificates.state.cancelled'> = {
  draft: 'certificates.state.draft', issued: 'certificates.state.issued', cancelled: 'certificates.state.cancelled',
}

export default function CertificatesPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [result, setResult] = useState<CertificateListView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setFailed(false)
    setLoading(true)
    loadCertificates(authenticatedApi, businessSession)
      .then((next) => { if (alive) setResult(next) })
      .catch(() => { if (alive) { setResult(null); setFailed(true) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [authenticatedApi, businessSession])

  const date = (value: string) => new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', {
    dateStyle: 'medium', timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
  const mass = (grams: number) => new Intl.NumberFormat(language === 'es' ? 'es-CL' : 'en-US', {
    maximumFractionDigits: grams >= 100_000 ? 0 : 1,
  }).format(grams / 1000)

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('certificates.eyebrow')}</p>
        <h1 className="text-3xl font-normal text-kumo-default">{t('certificates.title')}</h1>
        <p className="mt-2 text-sm text-kumo-subtle">{t('certificates.subtitle')}</p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">
        {loading ? <p className="p-6 text-sm text-kumo-subtle">{t('common.loading')}</p> : failed ? <p className="p-6 text-sm text-kumo-danger">{t('certificates.error')}</p> : result?.certificates.length ? result.certificates.map((certificate) => (
          <article key={certificate.id} className="border-b border-kumo-line last:border-b-0">
            <button type="button" onClick={() => setExpanded(expanded === certificate.id ? null : certificate.id)} className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[40px_1fr_auto_auto] sm:items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base"><NuevaunoIcon name="nuevauno_certificates" size={18} /></span>
              <span className="min-w-0"><span className="block text-sm text-kumo-default">{certificate.number} · {certificate.clientName}</span><span className="mt-1 block text-xs text-kumo-subtle">{date(certificate.issueDate)} · {t(stateKey[certificate.state])}</span></span>
              <span className="text-sm text-kumo-default">{mass(certificate.totalWeightGrams)} kg</span>
              <span className="text-xs text-kumo-subtle">{certificate.items?.length ?? 0} {t('certificates.items')}</span>
            </button>
            {expanded === certificate.id && <div className="border-t border-kumo-line bg-kumo-base px-4 py-3 sm:pl-16">
              {certificate.items?.map((item) => <div key={item.id} className="grid gap-1 border-b border-kumo-line py-2 text-xs last:border-b-0 sm:grid-cols-[1fr_auto_auto]"><span className="text-kumo-default">{item.wasteTypeName ?? item.description ?? t('certificates.material')}</span><span className="text-kumo-subtle">{date(item.pickupDate)}</span><span className="text-kumo-default">{mass(item.weightGrams)} kg</span></div>)}
            </div>}
          </article>
        )) : <p className="p-6 text-sm text-kumo-subtle">{t('certificates.empty')}</p>}
      </div>
    </div>
  )
}
