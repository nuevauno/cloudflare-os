import { useEffect, useState, type FormEvent } from 'react'
import type { AuthenticatedApi, BusinessSessionView, CommercialDocumentListView, CommercialDocumentView, DocumentEditorOptionsView, FiscalDocumentListView, FiscalDocumentView, FiscalFileView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import NuevaunoIcon from './components/NuevaunoIcon'

export function resolveSalesScope(session: ReturnType<typeof useAuthenticatedApi>['businessSession']) {
  if (!session) return null
  const companies = session.organizations.flatMap((organization) =>
    organization.companies.map((company) => ({ organizationId: organization.id, companyId: company.id })))
  return companies.find(({ companyId }) => companyId === session.activeCompanyId) ?? companies[0] ?? null
}

export async function loadCommercialDocuments(
  authenticatedApi: Pick<AuthenticatedApi, 'getBusinessSession' | 'listCommercialDocuments'>,
  session: BusinessSessionView | null,
): Promise<CommercialDocumentListView | null> {
  const resolvedSession = session ?? await authenticatedApi.getBusinessSession()
  const scope = resolveSalesScope(resolvedSession)
  if (!scope) return null
  return authenticatedApi.listCommercialDocuments(scope.organizationId, scope.companyId, 100)
}

export interface SalesDocumentsView {
  commercial: CommercialDocumentListView | null
  fiscal: FiscalDocumentListView | null
}

export async function loadSalesDocuments(
  authenticatedApi: Pick<AuthenticatedApi, 'getBusinessSession' | 'listCommercialDocuments' | 'listFiscalDocuments'>,
  session: BusinessSessionView | null,
): Promise<SalesDocumentsView> {
  const resolvedSession = session ?? await authenticatedApi.getBusinessSession()
  const scope = resolveSalesScope(resolvedSession)
  if (!scope) return { commercial: null, fiscal: null }
  const [commercial, fiscal] = await Promise.all([
    authenticatedApi.listCommercialDocuments(scope.organizationId, scope.companyId, 100),
    authenticatedApi.listFiscalDocuments(scope.organizationId, scope.companyId, 100),
  ])
  return { commercial, fiscal }
}

export function fiscalForCommercialDocument(documents: FiscalDocumentView[], commercialDocumentId: string): FiscalDocumentView | undefined {
  const matching = documents.filter((document) => document.commercialDocumentId === commercialDocumentId)
  return matching.find((document) => document.state === 'issued')
    ?? matching.find((document) => document.state === 'queued')
    ?? matching[0]
}

export function isFiscalPdf(file: FiscalFileView): boolean {
  return file.mimeType === 'application/pdf' || file.role === 'pdf' || file.role === 'representation_pdf'
}

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
  const [fiscalResult, setFiscalResult] = useState<FiscalDocumentListView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [options, setOptions] = useState<DocumentEditorOptionsView | null>(null)
  const [editing, setEditing] = useState<CommercialDocumentView | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [draftLines, setDraftLines] = useState<Array<{ id?: string; description: string; quantity: string; unitPriceMinor: number }>>([])

  useEffect(() => {
    let alive = true
    setFailed(false)
    setLoading(true)
    loadSalesDocuments(authenticatedApi, businessSession)
      .then((next) => { if (alive) { setResult(next.commercial); setFiscalResult(next.fiscal) } })
      .catch(() => { if (alive) { setResult(null); setFiscalResult(null); setFailed(true) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [authenticatedApi, businessSession])

  const scope = resolveSalesScope(businessSession)
  const refresh = async () => {
    const next = await loadSalesDocuments(authenticatedApi, businessSession)
    setResult(next.commercial); setFiscalResult(next.fiscal)
  }
  const openEditor = async (document: CommercialDocumentView | 'new') => {
    if (!scope) return
    setOptions(await authenticatedApi.listDocumentEditorOptions(scope.organizationId, scope.companyId))
    setDraftLines(document === 'new' ? [{ description: '', quantity: '1', unitPriceMinor: 0 }] : (document.lines ?? []).filter((line) => line.lineType === 'product').map((line) => ({ id: line.id, description: line.description, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor })))
    setEditing(document)
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!scope) return
    const form = new FormData(event.currentTarget), current = editing === 'new' ? undefined : editing ?? undefined
    setSaving(true)
    try {
      await authenticatedApi.saveCommercialDocument({
        requestId: crypto.randomUUID(), organizationId: scope.organizationId, companyId: scope.companyId,
        ...(current ? { documentId: current.id } : {}), contactId: String(form.get('contactId') ?? ''),
        kind: String(form.get('kind')) as 'invoice' | 'credit_note', reference: String(form.get('reference') ?? ''),
        issueDate: String(form.get('issueDate') ?? ''), dueDate: String(form.get('dueDate') ?? '') || undefined,
        currencyCode: 'CLP', currencyExponent: 0,
        lines: draftLines.map((line) => ({ ...line, taxBasisPoints: 1900 })),
      })
      setEditing(null); await refresh()
    } finally { setSaving(false) }
  }
  const changeState = async (document: CommercialDocumentView, action: 'post' | 'cancel') => {
    if (!scope || (action === 'post' && !window.confirm(t('sales.confirmPost')))) return
    await authenticatedApi.changeCommercialDocumentState({ requestId: crypto.randomUUID(), organizationId: scope.organizationId, companyId: scope.companyId, documentId: document.id, action })
    await refresh()
  }
  const issue = async (document: CommercialDocumentView) => {
    if (!scope || !window.confirm(t('sales.confirmIssue'))) return
    await authenticatedApi.requestFiscalIssue({ requestId: crypto.randomUUID(), organizationId: scope.organizationId, companyId: scope.companyId, sourceType: 'commercial_document', sourceId: document.id, documentCode: document.kind === 'invoice' ? '33' : '61', confirmation: 'ISSUE' })
    await refresh()
  }
  const readFile = async (fileId: string) => {
    if (!scope) return
    const file = await authenticatedApi.readFiscalFile(scope.organizationId, scope.companyId, fileId)
    const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mimeType }))
    return { file, url }
  }
  const view = async (fileId: string) => {
    const fiscalFile = await readFile(fileId)
    if (!fiscalFile) return
    window.open(fiscalFile.url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(fiscalFile.url), 60_000)
  }
  const download = async (fileId: string) => {
    const fiscalFile = await readFile(fileId)
    if (!fiscalFile) return
    const link = document.createElement('a'); link.href = fiscalFile.url; link.download = fiscalFile.file.name; link.click(); URL.revokeObjectURL(fiscalFile.url)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('sales.eyebrow')}</p>
        <h1 className="text-3xl font-normal text-kumo-default">{t('sales.title')}</h1>
        <p className="mt-2 text-sm text-kumo-subtle">{t('sales.subtitle')}</p>
        </div>
        <button type="button" onClick={() => void openEditor('new')} className="cursor-pointer bg-[#FE4A23] px-4 py-2 text-sm font-normal text-white">{t('sales.new')}</button>
      </header>
      {editing && options && <form onSubmit={(event) => void save(event)} className="mb-6 grid gap-4 border border-kumo-line bg-kumo-elevated p-5 md:grid-cols-2">
        <label className="text-xs text-kumo-subtle">{t('sales.customer')}<select name="contactId" required defaultValue={editing === 'new' ? '' : editing.contactId} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default"><option value="">{t('sales.choose')}</option>{options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.displayName}{contact.taxIdentifier ? ` · ${contact.taxIdentifier}` : ''}</option>)}</select></label>
        <label className="text-xs text-kumo-subtle">{t('sales.kind')}<select name="kind" defaultValue={editing === 'new' ? 'invoice' : editing.kind} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default"><option value="invoice">{t('sales.invoice')}</option><option value="credit_note">{t('sales.creditNote')}</option></select></label>
        <label className="text-xs text-kumo-subtle">{t('sales.issueDate')}<input name="issueDate" type="date" required defaultValue={editing === 'new' ? new Date().toISOString().slice(0, 10) : editing.issueDate} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
        <label className="text-xs text-kumo-subtle">{t('sales.dueDate')}<input name="dueDate" type="date" defaultValue={editing === 'new' ? '' : editing.dueDate} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
        <label className="text-xs text-kumo-subtle md:col-span-2">{t('sales.reference')}<input name="reference" defaultValue={editing === 'new' ? '' : editing.reference} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
        <div className="grid gap-3 md:col-span-2">{draftLines.map((line, index) => <div key={line.id ?? index} className="grid gap-3 border border-kumo-line p-3 md:grid-cols-[1fr_120px_150px_auto]">
          <label className="text-xs text-kumo-subtle">{t('sales.description')}<input required value={line.description} onChange={(event) => setDraftLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
          <label className="text-xs text-kumo-subtle">{t('sales.quantity')}<input inputMode="decimal" required value={line.quantity} onChange={(event) => setDraftLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
          <label className="text-xs text-kumo-subtle">{t('sales.unitPrice')}<input type="number" min="0" required value={line.unitPriceMinor} onChange={(event) => setDraftLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, unitPriceMinor: Number(event.target.value) } : row))} className="mt-2 w-full border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
          <button type="button" disabled={draftLines.length === 1} onClick={() => setDraftLines((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="mt-6 cursor-pointer border border-kumo-line px-3 py-2 text-xs text-kumo-default disabled:opacity-40">{t('sales.removeLine')}</button>
        </div>)}</div>
        <button type="button" onClick={() => setDraftLines((rows) => [...rows, { description: '', quantity: '1', unitPriceMinor: 0 }])} className="cursor-pointer justify-self-start border border-kumo-line px-3 py-2 text-xs text-kumo-default md:col-span-2">{t('sales.addLine')}</button>
        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setEditing(null)} className="cursor-pointer border border-kumo-line px-4 py-2 text-sm text-kumo-default">{t('common.cancel')}</button><button disabled={saving} className="cursor-pointer bg-[#FE4A23] px-4 py-2 text-sm font-normal text-white disabled:opacity-50">{t('common.save')}</button></div>
      </form>}
      <div className="overflow-hidden border border-kumo-line bg-kumo-elevated">
        {loading ? <p className="p-6 text-sm text-kumo-subtle">{t('common.loading')}</p> : failed ? <p className="p-6 text-sm text-kumo-danger">{t('sales.error')}</p> : result?.documents.length ? result.documents.map((document) => {
          const fiscal = fiscalForCommercialDocument(fiscalResult?.documents ?? [], document.id)
          return (
          <article key={document.id} className="border-b border-kumo-line last:border-b-0">
            <button type="button" onClick={() => setExpanded(expanded === document.id ? null : document.id)} className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[40px_1fr_auto_auto] sm:items-center">
              <span className="flex h-9 w-9 items-center justify-center border border-kumo-line bg-kumo-base"><NuevaunoIcon name="sale" size={17} /></span>
              <span className="min-w-0"><span className="block text-sm text-kumo-default">{document.number} · {document.contactDisplayName}</span><span className="mt-1 block text-xs text-kumo-subtle">{new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${document.issueDate}T12:00:00Z`))} · {t(stateKey[document.state])}</span></span>
              <span className="text-sm text-kumo-default">{money(document, document.totalMinor, language)}</span>
              <span className="text-xs text-kumo-subtle">{document.residualMinor ? `${t('sales.balance')}: ${money(document, document.residualMinor, language)}` : t('sales.paid')}</span>
            </button>
            {expanded === document.id && <div className="border-t border-kumo-line bg-kumo-base px-4 py-3 sm:pl-16">
              {document.lines?.filter((line) => line.lineType === 'product').map((line) => <div key={line.id} className="grid gap-1 border-b border-kumo-line py-2 text-xs last:border-b-0 sm:grid-cols-[1fr_auto_auto]"><span className="text-kumo-default">{line.description}</span><span className="text-kumo-subtle">{line.quantity}</span><span className="text-kumo-default">{money(document, line.totalMinor, language)}</span></div>)}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                {document.state === 'draft' && <><button type="button" onClick={() => void openEditor(document)} className="cursor-pointer border border-kumo-line px-3 py-2 text-xs text-kumo-default">{t('common.edit')}</button><button type="button" onClick={() => void changeState(document, 'cancel')} className="cursor-pointer border border-kumo-line px-3 py-2 text-xs text-kumo-default">{t('common.cancel')}</button><button type="button" onClick={() => void changeState(document, 'post')} className="cursor-pointer bg-[#FE4A23] px-3 py-2 text-xs font-normal text-white">{t('sales.post')}</button></>}
                {document.state === 'posted' && fiscal?.state === 'issued' && <>
                  <span className="text-xs text-kumo-success">{t('sales.fiscalIssued')}{fiscal.folio ? ` · ${t('sales.folio')} ${fiscal.folio}` : ''}</span>
                  {fiscal.files?.map((file) => isFiscalPdf(file) ? <span key={file.id} className="flex gap-2"><button type="button" onClick={() => void view(file.id)} className="cursor-pointer border border-kumo-line px-3 py-2 text-xs text-kumo-default hover:border-[#FE4A23]">{t('sales.viewPdf')}</button><button type="button" onClick={() => void download(file.id)} className="cursor-pointer border border-kumo-line px-3 py-2 text-xs text-kumo-default hover:border-[#FE4A23]">{t('sales.downloadPdf')}</button></span> : <button key={file.id} type="button" onClick={() => void download(file.id)} className="cursor-pointer border border-kumo-line px-3 py-2 text-xs text-kumo-default hover:border-[#FE4A23]">{t('sales.downloadXml')}</button>)}
                  {!fiscal.files?.some(isFiscalPdf) && <span className="text-xs text-kumo-subtle">{t('sales.pdfUnavailable')}</span>}
                </>}
                {document.state === 'posted' && fiscal?.state === 'queued' && <span className="border border-kumo-line px-3 py-2 text-xs text-kumo-subtle">{t('sales.fiscalQueued')}</span>}
                {document.state === 'posted' && fiscal?.state === 'error' && <><span className="text-xs text-kumo-danger">{t('sales.fiscalError')}</span><button type="button" onClick={() => void issue(document)} className="cursor-pointer bg-[#FE4A23] px-3 py-2 text-xs font-normal text-white">{t('sales.retryFiscal')}</button></>}
                {document.state === 'posted' && !fiscal && <button type="button" onClick={() => void issue(document)} className="cursor-pointer bg-[#FE4A23] px-3 py-2 text-xs font-normal text-white">{t('sales.issueFiscal')}</button>}
              </div>
            </div>}
          </article>
          )
        }) : <p className="p-6 text-sm text-kumo-subtle">{t('sales.empty')}</p>}
      </div>
    </div>
  )
}
