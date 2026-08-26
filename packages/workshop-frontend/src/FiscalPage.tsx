import { useEffect, useState } from 'react'
import type { AuthenticatedApi, BusinessSessionView, FiscalDocumentListView, FiscalDocumentView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import { resolveSalesScope } from './SalesPage'
import NuevaunoIcon from './components/NuevaunoIcon'

export async function loadFiscalDocuments(api: Pick<AuthenticatedApi, 'getBusinessSession' | 'listFiscalDocuments'>, session: BusinessSessionView | null): Promise<FiscalDocumentListView | null> {
  const resolved = session ?? await api.getBusinessSession(), scope = resolveSalesScope(resolved)
  return scope ? api.listFiscalDocuments(scope.organizationId, scope.companyId, 100) : null
}

export default function FiscalPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [result, setResult] = useState<FiscalDocumentListView | null>(null)
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { let alive = true; setLoading(true); setFailed(false); loadFiscalDocuments(authenticatedApi, businessSession).then((next) => { if (alive) setResult(next) }).catch(() => { if (alive) setFailed(true) }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [authenticatedApi, businessSession])
  const locale = language === 'es' ? 'es-CL' : 'en-US'
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  const money = (document: FiscalDocumentView) => new Intl.NumberFormat(locale, { style: 'currency', currency: document.currencyCode, maximumFractionDigits: document.currencyExponent }).format(document.amountTotalMinor / (10 ** document.currencyExponent))
  const stateKey = { issued: 'fiscal.state.issued', queued: 'fiscal.state.queued', error: 'fiscal.state.error' } as const
  const coverageKey = { complete: 'fiscal.coverage.complete', summary: 'fiscal.coverage.summary' } as const
  const download = async (fileId: string) => {
    if (!result) return
    const file = await authenticatedApi.readFiscalFile(result.organizationId, result.companyId, fileId)
    const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mimeType }))
    const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url)
  }
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
    <header className="mb-8"><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('fiscal.eyebrow')}</p><h1 className="text-3xl font-normal text-kumo-default">{t('fiscal.title')}</h1><p className="mt-2 text-sm text-kumo-subtle">{t('fiscal.subtitle')}</p></header>
    <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">{loading ? <p className="p-6 text-sm text-kumo-subtle">{t('common.loading')}</p> : failed ? <p className="p-6 text-sm text-kumo-danger">{t('fiscal.error')}</p> : result?.documents.length ? result.documents.map((document) => <article key={document.id} className="border-b border-kumo-line last:border-b-0">
      <button type="button" onClick={() => setExpanded(expanded === document.id ? null : document.id)} className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[40px_1fr_auto_auto] sm:items-center"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base"><NuevaunoIcon name="nuevauno_dte" size={18} /></span><span className="min-w-0"><span className="block text-sm text-kumo-default">{document.documentName}{document.folio ? ` · ${document.folio}` : ''}</span><span className="mt-1 block text-xs text-kumo-subtle">{document.contactDisplayName} · {date(document.issueDate)}</span></span><span className="text-sm text-kumo-default">{money(document)}</span><span className={document.state === 'issued' ? 'text-xs text-kumo-success' : document.state === 'error' ? 'text-xs text-kumo-danger' : 'text-xs text-kumo-subtle'}>{t(stateKey[document.state])}</span></button>
      {expanded === document.id && <div className="grid gap-3 border-t border-kumo-line bg-kumo-base px-4 py-4 text-xs sm:grid-cols-3 sm:pl-16"><div><span className="block text-kumo-subtle">{t('fiscal.coverage')}</span><span className="mt-1 block text-kumo-default">{t(coverageKey[document.coverageState])}</span></div><div><span className="block text-kumo-subtle">{t('fiscal.references')}</span><span className="mt-1 block text-kumo-default">{document.references?.length ?? 0}</span></div><div><span className="block text-kumo-subtle">{t('fiscal.files')}</span><span className="mt-1 flex flex-wrap gap-2">{document.files?.length ? document.files.map((file) => <button key={file.id} type="button" onClick={() => void download(file.id)} className="cursor-pointer rounded-lg border border-kumo-line px-2 py-1 text-kumo-default hover:border-[#FE4A23]">{file.role === 'representation_pdf' ? 'PDF' : 'XML'}</button>) : <span className="text-kumo-default">0</span>}</span></div>{document.errorMessage && <p className="sm:col-span-3 text-kumo-danger">{document.errorMessage}</p>}</div>}
    </article>) : <p className="p-6 text-sm text-kumo-subtle">{t('fiscal.empty')}</p>}</div>
  </div>
}
