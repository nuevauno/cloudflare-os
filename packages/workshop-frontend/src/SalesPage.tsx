import { useEffect, useState } from 'react'
import type { CommercialDocumentListView, CommercialDocumentView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import NuevaunoIcon from './components/NuevaunoIcon'

const stateKey: Record<CommercialDocumentView['state'], 'sales.state.draft' | 'sales.state.posted' | 'sales.state.canceled'> = {
  draft: 'sales.state.draft', posted: 'sales.state.posted', canceled: 'sales.state.canceled',
}

function money(document: CommercialDocumentView, value: number, language: string): string {
  return new Intl.NumberFormat(language === 'es' ? 'es-CL' : 'en-US', {
    style: 'currency', currency: document.currencyCode,
    minimumFractionDigits: document.currencyExponent, maximumFractionDigits: document.currencyExponent,
  }).format(value / (10 ** document.currencyExponent))
}

export default function SalesPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [result, setResult] = useState<CommercialDocumentListView | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const organizationId = businessSession?.activeOrganizationId
  const companyId = businessSession?.activeCompanyId

  useEffect(() => {
    let alive = true
    if (!organizationId || !companyId) { setResult(null); return () => { alive = false } }
    authenticatedApi.listCommercialDocuments(organizationId, companyId, 100)
      .then((next) => { if (alive) setResult(next) })
      .catch(() => { if (alive) setResult(null) })
    return () => { alive = false }
  }, [authenticatedApi, organizationId, companyId])

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('sales.eyebrow')}</p>
        <h1 className="text-3xl font-normal text-kumo-default">{t('sales.title')}</h1>
        <p className="mt-2 text-sm text-kumo-subtle">{t('sales.subtitle')}</p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">
        {result?.documents.length ? result.documents.map((document) => (
          <article key={document.id} className="border-b border-kumo-line last:border-b-0">
            <button type="button" onClick={() => setExpanded(expanded === document.id ? null : document.id)} className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[40px_1fr_auto_auto] sm:items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base"><NuevaunoIcon name="sale" size={17} /></span>
              <span className="min-w-0"><span className="block text-sm text-kumo-default">{document.number} · {document.contactDisplayName}</span><span className="mt-1 block text-xs text-kumo-subtle">{new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${document.issueDate}T12:00:00Z`))} · {t(stateKey[document.state])}</span></span>
              <span className="text-sm text-kumo-default">{money(document, document.totalMinor, language)}</span>
              <span className="text-xs text-kumo-subtle">{document.residualMinor ? `${t('sales.balance')}: ${money(document, document.residualMinor, language)}` : t('sales.paid')}</span>
            </button>
            {expanded === document.id && <div className="border-t border-kumo-line bg-kumo-base px-4 py-3 sm:pl-16">
              {document.lines?.map((line) => <div key={line.id} className="grid gap-1 border-b border-kumo-line py-2 text-xs last:border-b-0 sm:grid-cols-[1fr_auto_auto]"><span className="text-kumo-default">{line.description}</span><span className="text-kumo-subtle">{line.quantity}</span><span className="text-kumo-default">{money(document, line.totalMinor, language)}</span></div>)}
            </div>}
          </article>
        )) : <p className="p-6 text-sm text-kumo-subtle">{t('sales.empty')}</p>}
      </div>
    </div>
  )
}
