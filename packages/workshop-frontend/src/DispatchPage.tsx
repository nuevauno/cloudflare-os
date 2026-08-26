import { useEffect, useState } from 'react'
import type { AuthenticatedApi, BusinessSessionView, DispatchDocumentView, DispatchListView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import { resolveSalesScope } from './SalesPage'
import NuevaunoIcon from './components/NuevaunoIcon'

/** Loads dispatch documents only after resolving an authorized company. */
export async function loadDispatchDocuments(
  authenticatedApi: Pick<AuthenticatedApi, 'getBusinessSession' | 'listDispatchDocuments'>,
  session: BusinessSessionView | null,
): Promise<DispatchListView | null> {
  const resolvedSession = session ?? await authenticatedApi.getBusinessSession()
  const scope = resolveSalesScope(resolvedSession)
  if (!scope) return null
  return authenticatedApi.listDispatchDocuments(scope.organizationId, scope.companyId, 100)
}

const stateKey: Record<DispatchDocumentView['state'], 'dispatch.state.draft' | 'dispatch.state.issued' | 'dispatch.state.cancelled'> = {
  draft: 'dispatch.state.draft', issued: 'dispatch.state.issued', cancelled: 'dispatch.state.cancelled',
}

export default function DispatchPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [result, setResult] = useState<DispatchListView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setFailed(false)
    setLoading(true)
    loadDispatchDocuments(authenticatedApi, businessSession)
      .then((next) => { if (alive) setResult(next) })
      .catch(() => { if (alive) { setResult(null); setFailed(true) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [authenticatedApi, businessSession])

  const locale = language === 'es' ? 'es-CL' : 'en-US'
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  const money = (document: DispatchDocumentView) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: document.currencyCode, maximumFractionDigits: document.currencyExponent,
  }).format(document.amountTotalMinor / (10 ** document.currencyExponent))
  const quantity = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value / 1000)

  return <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
    <header className="mb-8"><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('dispatch.eyebrow')}</p><h1 className="text-3xl font-normal text-kumo-default">{t('dispatch.title')}</h1><p className="mt-2 text-sm text-kumo-subtle">{t('dispatch.subtitle')}</p></header>
    <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">
      {loading ? <p className="p-6 text-sm text-kumo-subtle">{t('common.loading')}</p> : failed ? <p className="p-6 text-sm text-kumo-danger">{t('dispatch.error')}</p> : result?.documents.length ? result.documents.map((document) => <article key={document.id} className="border-b border-kumo-line last:border-b-0">
        <button type="button" onClick={() => setExpanded(expanded === document.id ? null : document.id)} className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[40px_1fr_auto_auto] sm:items-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base"><NuevaunoIcon name="nuevauno_dte" size={18} /></span>
          <span className="min-w-0"><span className="block text-sm text-kumo-default">{document.number}{document.folio ? ` · ${t('dispatch.folio')} ${document.folio}` : ''}</span><span className="mt-1 block text-xs text-kumo-subtle">{date(document.issueDate)} · {t(stateKey[document.state])}</span></span>
          <span className="text-sm text-kumo-default">{money(document)}</span><span className="text-xs text-kumo-subtle">{document.lines?.length ?? 0} {t('dispatch.items')}</span>
        </button>
        {expanded === document.id && <div className="border-t border-kumo-line bg-kumo-base px-4 py-3 sm:pl-16">{document.lines?.map((line) => <div key={line.id} className="grid gap-1 border-b border-kumo-line py-2 text-xs last:border-b-0 sm:grid-cols-[1fr_auto_auto]"><span className="text-kumo-default">{line.name}</span><span className="text-kumo-subtle">{quantity(line.quantityMilli)} {line.unitName ?? ''}</span><span className="text-kumo-default">{new Intl.NumberFormat(locale, { style: 'currency', currency: document.currencyCode, maximumFractionDigits: document.currencyExponent }).format(line.priceSubtotalMinor / (10 ** document.currencyExponent))}</span></div>)}</div>}
      </article>) : <p className="p-6 text-sm text-kumo-subtle">{t('dispatch.empty')}</p>}
    </div>
  </div>
}
