import { useEffect, useMemo, useState } from 'react'
import type { CommercialDocumentListView, CommercialDocumentView, RecordCommercialPaymentRequest } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { resolveSalesScope } from './SalesPage'
import { useI18n } from './i18n'
import NuevaunoIcon from './components/NuevaunoIcon'

type Filter = 'all' | 'overdue' | 'dueSoon' | 'current' | 'paid'
type Method = RecordCommercialPaymentRequest['method']

function formatMoney(document: CommercialDocumentView, value: number, language: string): string {
  return new Intl.NumberFormat(language === 'es' ? 'es-CL' : 'en-US', {
    style: 'currency', currency: document.currencyCode,
    minimumFractionDigits: document.currencyExponent, maximumFractionDigits: document.currencyExponent,
  }).format(value / (10 ** document.currencyExponent))
}

export function dateStatus(document: CommercialDocumentView, today: string): Exclude<Filter, 'all' | 'paid'> | 'paid' {
  if (document.residualMinor === 0) return 'paid'
  if (document.dueDate && document.dueDate < today) return 'overdue'
  const soon = new Date(`${today}T12:00:00Z`)
  soon.setUTCDate(soon.getUTCDate() + 7)
  if (document.dueDate && document.dueDate <= soon.toISOString().slice(0, 10)) return 'dueSoon'
  return 'current'
}

export function amountToMinor(value: string, exponent: number): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const [whole, decimals = ''] = normalized.split('.')
  if (decimals.length > exponent) return null
  const amount = Number(`${whole}${decimals.padEnd(exponent, '0')}`)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

export default function CollectionsPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [result, setResult] = useState<CommercialDocumentListView | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [paying, setPaying] = useState<CommercialDocumentView | null>(null)
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState<Method>('bank_transfer')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const [paymentRequestId, setPaymentRequestId] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const load = async () => {
    const session = businessSession ?? await authenticatedApi.getBusinessSession()
    const scope = resolveSalesScope(session)
    if (!scope) return setResult(null)
    setResult(await authenticatedApi.listCommercialDocuments(scope.organizationId, scope.companyId, 100))
  }
  useEffect(() => {
    let alive = true
    setFailed(false)
    load().catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticatedApi, businessSession])

  const invoices = useMemo(() => result?.documents.filter((document) => document.kind === 'invoice' && document.state === 'posted') ?? [], [result])
  const visible = invoices.filter((document) => filter === 'all' || dateStatus(document, today) === filter)
  const sum = (predicate: (document: CommercialDocumentView) => boolean, value: (document: CommercialDocumentView) => number) =>
    invoices.filter(predicate).reduce((total, document) => total + value(document), 0)
  const sample = invoices[0]
  const cards = sample ? [
    [t('collections.receivable'), sum(() => true, (document) => document.residualMinor)],
    [t('collections.overdue'), sum((document) => dateStatus(document, today) === 'overdue', (document) => document.residualMinor)],
    [t('collections.dueSoon'), sum((document) => dateStatus(document, today) === 'dueSoon', (document) => document.residualMinor)],
    [t('collections.collected'), sum(() => true, (document) => Math.max(0, document.totalMinor - document.residualMinor))],
  ] as const : []

  const openPayment = (document: CommercialDocumentView) => {
    setPaying(document)
    setAmount((document.residualMinor / (10 ** document.currencyExponent)).toFixed(document.currencyExponent))
    setPaymentFailed(false)
    setPaymentRequestId(crypto.randomUUID())
  }
  const savePayment = async () => {
    if (!paying || !result) return
    const amountMinor = amountToMinor(amount, paying.currencyExponent)
    if (!amountMinor || amountMinor > paying.residualMinor) return setPaymentFailed(true)
    setSaving(true)
    setPaymentFailed(false)
    try {
      await authenticatedApi.recordCommercialPayment({
        requestId: paymentRequestId, organizationId: result.organizationId, companyId: result.companyId,
        documentId: paying.id, amountMinor, paidOn, method, ...(reference.trim() ? { reference: reference.trim() } : {}),
      })
      await load()
      setPaying(null)
      setReference('')
    } catch {
      setPaymentFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
    <header className="mb-7">
      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('collections.eyebrow')}</p>
      <h1 className="text-3xl font-normal text-kumo-default">{t('collections.title')}</h1>
      <p className="mt-2 text-sm text-kumo-subtle">{t('collections.subtitle')}</p>
    </header>
    {sample && <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-kumo-line bg-kumo-elevated p-4"><span className="text-xs text-kumo-subtle">{label}</span><span className="mt-2 block text-xl text-kumo-default">{formatMoney(sample, value, language)}</span></div>)}</div>}
    <div className="mb-4 flex flex-wrap gap-2">{(['all', 'overdue', 'dueSoon', 'current', 'paid'] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs ${filter === item ? 'border-[#FE4A23] bg-[#FE4A23] text-white' : 'border-kumo-line bg-kumo-elevated text-kumo-default'}`}>{t(`collections.${item}`)}</button>)}</div>
    <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">
      {failed ? <p className="p-6 text-sm text-kumo-danger">{t('collections.error')}</p> : visible.length ? visible.map((document) => <article key={document.id} className="grid gap-3 border-b border-kumo-line p-4 last:border-b-0 sm:grid-cols-[40px_1fr_auto_auto] sm:items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base"><NuevaunoIcon name="nuevauno_billing" size={17} /></span>
        <span><span className="block text-sm text-kumo-default">{document.number} · {document.contactDisplayName}</span><span className="mt-1 block text-xs text-kumo-subtle">{document.dueDate ? `${t('collections.due')} ${document.dueDate}` : t('collections.noDue')}</span></span>
        <span className="text-sm text-kumo-default">{formatMoney(document, document.residualMinor, language)}</span>
        {document.residualMinor > 0 ? <button type="button" onClick={() => openPayment(document)} className="cursor-pointer rounded-xl bg-[#FE4A23] px-3 py-2 text-xs text-white">{t('collections.record')}</button> : <span className="text-xs text-kumo-subtle">{t('collections.paid')}</span>}
      </article>) : <p className="p-6 text-sm text-kumo-subtle">{t('collections.empty')}</p>}
    </div>
    {paying && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-kumo-line bg-kumo-elevated p-5 shadow-xl">
        <h2 className="text-xl font-normal text-kumo-default">{t('collections.record')}</h2>
        <p className="mt-1 text-sm text-kumo-subtle">{paying.number} · {paying.contactDisplayName}</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1 text-xs text-kumo-subtle">{t('collections.amount')}<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
          <label className="grid gap-1 text-xs text-kumo-subtle">{t('collections.date')}<input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} className="rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
          <label className="grid gap-1 text-xs text-kumo-subtle">{t('collections.method')}<select value={method} onChange={(event) => setMethod(event.target.value as Method)} className="rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default">{(['bank_transfer', 'card', 'cash', 'check', 'other'] as Method[]).map((item) => <option key={item} value={item}>{t(`collections.method.${item}`)}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-kumo-subtle">{t('collections.reference')}<input value={reference} onChange={(event) => setReference(event.target.value)} className="rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default" /></label>
        </div>
        {paymentFailed && <p className="mt-3 text-xs text-kumo-danger">{t('collections.paymentError')}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPaying(null)} className="cursor-pointer rounded-xl border border-kumo-line px-3 py-2 text-xs text-kumo-default">{t('collections.cancel')}</button><button type="button" disabled={saving} onClick={savePayment} className="cursor-pointer rounded-xl bg-[#FE4A23] px-3 py-2 text-xs text-white disabled:opacity-50">{saving ? t('collections.saving') : t('collections.save')}</button></div>
      </div>
    </div>}
  </div>
}
