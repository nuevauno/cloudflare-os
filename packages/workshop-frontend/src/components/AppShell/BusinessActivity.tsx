import { useEffect, useMemo, useState } from 'react'
import type { ActivityEventView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from '../../AuthContext'
import { useI18n } from '../../i18n'
import NuevaunoIcon from '../NuevaunoIcon'
import { activityAppIcon } from './activityAppIcon'

const POLL_MS = 10_000

function labelFor(event: ActivityEventView, language: 'es' | 'en'): string {
  const actor = event.actorDisplayName ?? (language === 'es' ? 'El equipo' : 'The team')
  const labels: Record<string, [string, string]> = {
    'pos.order.completed': [`${actor} completó una venta`, `${actor} completed a sale`],
    'sale.invoice.issued': [`${actor} emitió una factura`, `${actor} issued an invoice`],
    'sale.invoice.imported': [`${actor} incorporó una factura`, `${actor} imported an invoice`],
    'sale.credit_note.imported': [`${actor} incorporó una nota de crédito`, `${actor} imported a credit note`],
    'crm.lead.created': [`${actor} creó una oportunidad`, `${actor} created an opportunity`],
    'contact.created': [`${actor} agregó un contacto`, `${actor} added a contact`],
    'kodo.task.completed': ['KODO completó una tarea', 'KODO completed a task'],
    'catalog.imported': [`${actor} actualizó contactos y productos`, `${actor} updated contacts and products`],
    'billing.snapshot_imported': [`${actor} actualizó el plan`, `${actor} updated the plan`],
    'collection.payment.recorded': [`${actor} registró un pago`, `${actor} recorded a payment`],
    'certificate.imported': [`${actor} incorporó un certificado`, `${actor} imported a certificate`],
    'certificate.created': [`${actor} creó un certificado`, `${actor} created a certificate`],
    'certificate.issued': [`${actor} emitió un certificado`, `${actor} issued a certificate`],
    'certificate.cancelled': [`${actor} anuló un certificado`, `${actor} cancelled a certificate`],
  }
  const translated = labels[event.activityKey ?? event.eventType]
  if (translated) return translated[language === 'es' ? 0 : 1]
  return language === 'es' ? `${actor} actualizó ${event.entityType ?? 'la empresa'}` : `${actor} updated ${event.entityType ?? 'the company'}`
}

export default function BusinessActivity() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [events, setEvents] = useState<ActivityEventView[]>([])
  const organizationId = businessSession?.activeOrganizationId
  const companyId = businessSession?.activeCompanyId
  const timezone = businessSession?.organizations.flatMap((organization) => organization.companies)
    .find((company) => company.id === companyId)?.timezone ?? 'America/Santiago'

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const refresh = async () => {
      if (!organizationId || !companyId) return setEvents([])
      try {
        const feed = await authenticatedApi.listBusinessActivity(organizationId, companyId, 12)
        if (!cancelled) setEvents(feed.events)
      } catch {
        // Keep the last good snapshot during a transient reconnect.
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void refresh(), POLL_MS)
      }
    }
    void refresh()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [authenticatedApi, organizationId, companyId])

  const formatter = useMemo(() => new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: timezone,
  }), [language, timezone])

  return (
    <section aria-labelledby="business-activity-title" className="rounded-2xl border border-kumo-line bg-kumo-elevated p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('activity.live')}</p>
          <h2 id="business-activity-title" className="mt-1 text-lg font-normal text-kumo-default">{t('activity.title')}</h2>
        </div>
        <span className="h-2 w-2 bg-[#FE4A23] motion-safe:animate-pulse" aria-label={t('activity.updating')} />
      </div>
      {events.length ? (
        <ol className="max-h-64 divide-y divide-kumo-line overflow-y-auto">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 py-3 first:pt-1">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base">
                <NuevaunoIcon name={activityAppIcon(event)} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-kumo-default">{labelFor(event, language)}</p>
                <p className="mt-1 text-[11px] text-kumo-subtle">{formatter.format(new Date(event.occurredAt))}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="py-4 text-sm text-kumo-subtle">{t('activity.empty')}</p>}
    </section>
  )
}
