import { useState } from 'react'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import type { BillingInvoiceView, SubscriptionView } from '@gadgets/workshop-shared/api'

const subscriptionStatusKey: Record<SubscriptionView['status'], 'billing.status.trialing' | 'billing.status.active' | 'billing.status.past_due' | 'billing.status.paused' | 'billing.status.canceled'> = {
  trialing: 'billing.status.trialing', active: 'billing.status.active', past_due: 'billing.status.past_due', paused: 'billing.status.paused', canceled: 'billing.status.canceled',
}
const invoiceStatusKey: Record<BillingInvoiceView['status'], 'billing.invoiceStatus.draft' | 'billing.invoiceStatus.open' | 'billing.invoiceStatus.paid' | 'billing.invoiceStatus.void' | 'billing.invoiceStatus.uncollectible'> = {
  draft: 'billing.invoiceStatus.draft', open: 'billing.invoiceStatus.open', paid: 'billing.invoiceStatus.paid', void: 'billing.invoiceStatus.void', uncollectible: 'billing.invoiceStatus.uncollectible',
}

function money(value: number, currency: string, exponent: number, language: string): string {
  return new Intl.NumberFormat(language === 'es' ? 'es-CL' : 'en-US', {
    style: 'currency', currency, minimumFractionDigits: exponent, maximumFractionDigits: exponent,
  }).format(value / (10 ** exponent))
}

export default function BillingPage() {
  const { authenticatedApi, businessSession, billingOverview, refreshBillingOverview } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [cancelling, setCancelling] = useState(false)
  const subscription = billingOverview?.subscription
  const organizationId = businessSession?.activeOrganizationId

  const requestCancellation = async () => {
    if (!organizationId || !window.confirm(t('billing.cancelConfirm'))) return
    setCancelling(true)
    try {
      await authenticatedApi.requestSubscriptionCancellation(organizationId)
      await refreshBillingOverview()
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('billing.eyebrow')}</p>
        <h1 className="text-3xl font-normal text-kumo-default">{t('billing.title')}</h1>
        <p className="mt-2 text-sm text-kumo-subtle">{t('billing.subtitle')}</p>
      </header>

      <section className="rounded-2xl border border-kumo-line bg-kumo-elevated p-5 md:p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-kumo-subtle">{t('billing.currentPlan')}</p>
            <p className="mt-2 text-2xl text-kumo-default">{subscription?.plan.name ?? t('status.noPlan')}</p>
            {subscription?.plan.description && <p className="mt-2 max-w-xl text-sm text-kumo-subtle">{subscription.plan.description}</p>}
          </div>
          {subscription && (
            <div className="text-left md:text-right">
              <p className="text-2xl text-kumo-default">{money(subscription.plan.amountMinor, subscription.plan.currencyCode, subscription.plan.currencyExponent, language)}</p>
              <p className="mt-1 text-xs text-kumo-subtle">{subscription.plan.interval === 'year' ? t('billing.perYear') : subscription.plan.interval === 'month' ? t('billing.perMonth') : t('billing.customInterval')}</p>
            </div>
          )}
        </div>
        {subscription && (
          <div className="mt-6 grid gap-3 border-t border-kumo-line pt-5 sm:grid-cols-3">
            <div><p className="text-[11px] uppercase tracking-[0.1em] text-kumo-subtle">{t('billing.status')}</p><p className="mt-1 text-sm text-kumo-default">{t(subscriptionStatusKey[subscription.status])}</p></div>
            <div><p className="text-[11px] uppercase tracking-[0.1em] text-kumo-subtle">{t('billing.renewal')}</p><p className="mt-1 text-sm text-kumo-default">{subscription.currentPeriodEnd ? new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'long' }).format(new Date(subscription.currentPeriodEnd)) : '—'}</p></div>
            <div className="flex items-end gap-2 sm:justify-end">
              {subscription.portalUrl && <a href={subscription.portalUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#FE4A23] px-4 py-2 text-sm text-white">{t('billing.managePayment')}</a>}
              {billingOverview?.canManage && !subscription.cancelAtPeriodEnd && subscription.status !== 'canceled' && <button type="button" disabled={cancelling} onClick={() => void requestCancellation()} className="rounded-xl border border-kumo-line px-4 py-2 text-sm text-kumo-default disabled:opacity-50">{cancelling ? t('billing.cancelling') : t('billing.cancel')}</button>}
            </div>
          </div>
        )}
        {subscription?.cancelAtPeriodEnd && <p className="mt-5 rounded-xl border border-[#FE4A23]/25 bg-[#FE4A23]/8 p-3 text-sm text-kumo-default">{t('billing.cancellationScheduled')}</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-normal text-kumo-default">{t('billing.invoices')}</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">
          {billingOverview?.invoices.length ? billingOverview.invoices.map((invoice) => (
            <article key={invoice.id} className="flex flex-col gap-3 border-b border-kumo-line p-4 last:border-b-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="text-sm text-kumo-default">{invoice.number}</p><p className="mt-1 text-xs text-kumo-subtle">{invoice.issuedAt ? new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'medium' }).format(new Date(invoice.issuedAt)) : '—'} · {t(invoiceStatusKey[invoice.status])}</p></div>
              <p className="text-sm text-kumo-default">{money(invoice.totalMinor, invoice.currencyCode, invoice.currencyExponent, language)}</p>
              <div className="flex gap-2">
                {invoice.invoicePdfUrl && <a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-kumo-line px-3 py-1.5 text-xs text-kumo-default">PDF</a>}
                {invoice.status === 'open' && invoice.hostedInvoiceUrl && <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#FE4A23] px-3 py-1.5 text-xs text-white">{t('billing.pay')}</a>}
              </div>
            </article>
          )) : <p className="p-5 text-sm text-kumo-subtle">{t('billing.noInvoices')}</p>}
        </div>
      </section>
    </div>
  )
}
