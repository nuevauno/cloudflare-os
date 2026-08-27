import { useEffect, useState, type FormEvent } from 'react'
import type { AuthenticatedApi, BusinessSessionView, DispatchDocumentView, DispatchListView, DocumentEditorOptionsView } from '@gadgets/workshop-shared/api'
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
  const [options, setOptions] = useState<DocumentEditorOptionsView | null>(null)
  const [editing, setEditing] = useState<DispatchDocumentView | 'new' | null>(null)
  const [draftLines, setDraftLines] = useState<Array<{ id?: string; name: string; quantityMilli: number; priceUnitMinor: number }>>([])

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

  const scope = resolveSalesScope(businessSession)
  const refresh = async () => setResult(await loadDispatchDocuments(authenticatedApi, businessSession))
  const openEditor = async (document: DispatchDocumentView | 'new') => {
    if (!scope) return
    setOptions(await authenticatedApi.listDocumentEditorOptions(scope.organizationId, scope.companyId))
    setDraftLines(document === 'new' ? [{ name: '', quantityMilli: 1000, priceUnitMinor: 0 }] : (document.lines ?? []).map((line) => ({ id: line.id, name: line.name, quantityMilli: line.quantityMilli, priceUnitMinor: line.priceUnitMinor })))
    setEditing(document)
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!scope) return
    const form = new FormData(event.currentTarget), current = editing === 'new' ? undefined : editing ?? undefined
    await authenticatedApi.saveDispatchDocument({ requestId: crypto.randomUUID(), organizationId: scope.organizationId, companyId: scope.companyId, ...(current ? { documentId: current.id } : {}), contactId: String(form.get('contactId') ?? ''), issueDate: String(form.get('issueDate') ?? ''), transferType: String(form.get('transferType')) as DispatchDocumentView['transferType'], destinationAddress: String(form.get('destinationAddress') ?? ''), destinationCommune: String(form.get('destinationCommune') ?? ''), reference: String(form.get('reference') ?? ''), affectsTax: form.get('affectsTax') === 'on', currencyCode: 'CLP', currencyExponent: 0, lines: draftLines.map((line) => ({ ...line, unitName: 'UN' })) })
    setEditing(null); await refresh()
  }
  const issue = async (document: DispatchDocumentView) => {
    if (!scope || !window.confirm(t('dispatch.confirmIssue'))) return
    await authenticatedApi.requestFiscalIssue({ requestId: crypto.randomUUID(), organizationId: scope.organizationId, companyId: scope.companyId, sourceType: 'dispatch_document', sourceId: document.id, documentCode: '52', confirmation: 'ISSUE' })
    await refresh()
  }

  const locale = language === 'es' ? 'es-CL' : 'en-US'
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  const money = (document: DispatchDocumentView) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: document.currencyCode, maximumFractionDigits: document.currencyExponent,
  }).format(document.amountTotalMinor / (10 ** document.currencyExponent))
  const quantity = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value / 1000)

  return <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
    <header className="mb-8 flex items-end justify-between gap-4"><div><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('dispatch.eyebrow')}</p><h1 className="text-3xl font-normal text-kumo-default">{t('dispatch.title')}</h1><p className="mt-2 text-sm text-kumo-subtle">{t('dispatch.subtitle')}</p></div><button type="button" onClick={() => void openEditor('new')} className="cursor-pointer rounded-xl bg-[#FE4A23] px-4 py-2 text-sm font-normal text-white">{t('dispatch.new')}</button></header>
    {editing && options && <form onSubmit={(event) => void save(event)} className="mb-6 grid gap-4 rounded-2xl border border-kumo-line bg-kumo-elevated p-5 md:grid-cols-2">
      <label className="text-xs text-kumo-subtle">{t('dispatch.customer')}<select name="contactId" required defaultValue={editing === 'new' ? '' : editing.contactId} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default"><option value="">{t('sales.choose')}</option>{options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.displayName}</option>)}</select></label>
      <label className="text-xs text-kumo-subtle">{t('sales.issueDate')}<input name="issueDate" type="date" required defaultValue={editing === 'new' ? new Date().toISOString().slice(0, 10) : editing.issueDate} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
      <label className="text-xs text-kumo-subtle">{t('dispatch.transferType')}<select name="transferType" defaultValue={editing === 'new' ? '5' : editing.transferType} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default">{['1','2','3','4','5','6','7','8','9'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="text-xs text-kumo-subtle">{t('dispatch.reference')}<input name="reference" defaultValue={editing === 'new' ? '' : editing.reference} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
      <label className="text-xs text-kumo-subtle">{t('dispatch.address')}<input name="destinationAddress" required defaultValue={editing === 'new' ? '' : editing.destinationAddress} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
      <label className="text-xs text-kumo-subtle">{t('dispatch.commune')}<input name="destinationCommune" required defaultValue={editing === 'new' ? '' : editing.destinationCommune} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
      <div className="grid gap-3 md:col-span-2">{draftLines.map((line, index) => <div key={line.id ?? index} className="grid gap-3 rounded-xl border border-kumo-line p-3 md:grid-cols-[1fr_120px_150px_auto]">
        <label className="text-xs text-kumo-subtle">{t('sales.description')}<input required value={line.name} onChange={(event) => setDraftLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
        <label className="text-xs text-kumo-subtle">{t('sales.quantity')}<input type="number" min="0.001" step="0.001" required value={line.quantityMilli / 1000} onChange={(event) => setDraftLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantityMilli: Math.round(Number(event.target.value) * 1000) } : row))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
        <label className="text-xs text-kumo-subtle">{t('sales.unitPrice')}<input type="number" min="0" required value={line.priceUnitMinor} onChange={(event) => setDraftLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, priceUnitMinor: Number(event.target.value) } : row))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
        <button type="button" disabled={draftLines.length === 1} onClick={() => setDraftLines((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="mt-6 cursor-pointer rounded-xl border border-kumo-line px-3 py-2 text-xs text-kumo-default disabled:opacity-40">{t('sales.removeLine')}</button>
      </div>)}</div>
      <button type="button" onClick={() => setDraftLines((rows) => [...rows, { name: '', quantityMilli: 1000, priceUnitMinor: 0 }])} className="cursor-pointer justify-self-start rounded-xl border border-kumo-line px-3 py-2 text-xs text-kumo-default md:col-span-2">{t('sales.addLine')}</button>
      <label className="flex items-center gap-2 text-xs text-kumo-subtle"><input name="affectsTax" type="checkbox" defaultChecked={editing === 'new' ? true : editing.affectsTax} />{t('dispatch.affectsTax')}</label>
      <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setEditing(null)} className="cursor-pointer rounded-xl border border-kumo-line px-4 py-2 text-sm text-kumo-default">{t('common.cancel')}</button><button className="cursor-pointer rounded-xl bg-[#FE4A23] px-4 py-2 text-sm font-normal text-white">{t('common.save')}</button></div>
    </form>}
    <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">
      {loading ? <p className="p-6 text-sm text-kumo-subtle">{t('common.loading')}</p> : failed ? <p className="p-6 text-sm text-kumo-danger">{t('dispatch.error')}</p> : result?.documents.length ? result.documents.map((document) => <article key={document.id} className="border-b border-kumo-line last:border-b-0">
        <button type="button" onClick={() => setExpanded(expanded === document.id ? null : document.id)} className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[40px_1fr_auto_auto] sm:items-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base"><NuevaunoIcon name="nuevauno_dte" size={18} /></span>
          <span className="min-w-0"><span className="block text-sm text-kumo-default">{document.number}{document.folio ? ` · ${t('dispatch.folio')} ${document.folio}` : ''}</span><span className="mt-1 block text-xs text-kumo-subtle">{date(document.issueDate)} · {t(stateKey[document.state])}</span></span>
          <span className="text-sm text-kumo-default">{money(document)}</span><span className="text-xs text-kumo-subtle">{document.lines?.length ?? 0} {t('dispatch.items')}</span>
        </button>
        {expanded === document.id && <div className="border-t border-kumo-line bg-kumo-base px-4 py-3 sm:pl-16">{document.lines?.map((line) => <div key={line.id} className="grid gap-1 border-b border-kumo-line py-2 text-xs last:border-b-0 sm:grid-cols-[1fr_auto_auto]"><span className="text-kumo-default">{line.name}</span><span className="text-kumo-subtle">{quantity(line.quantityMilli)} {line.unitName ?? ''}</span><span className="text-kumo-default">{new Intl.NumberFormat(locale, { style: 'currency', currency: document.currencyCode, maximumFractionDigits: document.currencyExponent }).format(line.priceSubtotalMinor / (10 ** document.currencyExponent))}</span></div>)}{document.state === 'draft' && <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => void openEditor(document)} className="cursor-pointer rounded-xl border border-kumo-line px-3 py-2 text-xs text-kumo-default">{t('common.edit')}</button><button type="button" onClick={() => void issue(document)} className="cursor-pointer rounded-xl bg-[#FE4A23] px-3 py-2 text-xs font-normal text-white">{t('dispatch.issue')}</button></div>}</div>}
      </article>) : <p className="p-6 text-sm text-kumo-subtle">{t('dispatch.empty')}</p>}
    </div>
  </div>
}
