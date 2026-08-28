import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuthenticatedApi } from '../../AuthContext'
import { useI18n } from '../../i18n'
import { RELEASE_VERSION } from '../../release'
import { statusPlanLabel } from './businessChrome'

function StatusDivider() {
  return <span aria-hidden="true" className="h-4 w-px shrink-0 bg-kumo-line" />
}

export default function BottomStatusBar() {
  const { businessSession, billingOverview, selectBusinessContext } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [now, setNow] = useState(() => new Date())
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const companies = businessSession?.organizations.flatMap((organization) =>
    organization.companies.map((company) => ({ organization, company }))) ?? []
  const active = companies.find(({ company }) => company.id === businessSession?.activeCompanyId) ?? companies[0]
  const timezone = active?.company.timezone ?? 'America/Santiago'
  const dateTime = useMemo(() => new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', {
    timeZone: timezone, dateStyle: 'medium', timeStyle: 'medium',
  }).format(now), [language, now, timezone])
  const planName = billingOverview?.subscription?.plan.name ?? t('status.noPlan')

  return (
    <footer className="flex h-10 shrink-0 items-center gap-3 overflow-x-auto border-t border-kumo-line bg-kumo-elevated px-3 text-[11px] text-kumo-subtle md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 uppercase tracking-[0.12em]">{t('status.company')}</span>
        <select
            aria-label={t('status.selectCompany')}
            value={active?.company.id ?? ''}
            disabled={!companies.length || switching}
            onChange={(event) => {
              const selected = companies.find(({ company }) => company.id === event.target.value)
              if (!selected) return
              setSwitchError(false)
              setSwitching(true)
              void selectBusinessContext(selected.organization.id, selected.company.id)
                .catch(() => setSwitchError(true))
                .finally(() => setSwitching(false))
            }}
            className="max-w-[220px] truncate border border-kumo-line bg-kumo-base px-2 py-1 text-[11px] text-kumo-default outline-none focus:border-kumo-accent disabled:opacity-60"
          >
            {!companies.length && <option value="">{t('status.noCompany')}</option>}
            {companies.map(({ company }) => (
              <option key={company.id} value={company.id}>{company.displayName}</option>
            ))}
        </select>
        {switchError && <span role="alert" className="shrink-0 text-[#FE4A23]">No pudimos cambiar de empresa.</span>}
      </div>
      <StatusDivider />
      <span className="hidden shrink-0 uppercase tracking-[0.12em] sm:inline">NUEVAUNO OS {RELEASE_VERSION}</span>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <StatusDivider />
        <Link
          to="/billing"
          className="border border-[#FE4A23]/35 bg-[#FE4A23]/10 px-2.5 py-1 uppercase tracking-[0.08em] text-[#FE4A23] transition-colors hover:bg-[#FE4A23]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE4A23]/45"
        >
          {statusPlanLabel(t('status.plan'), planName, language)}
        </Link>
        <StatusDivider />
        <time dateTime={now.toISOString()} title={timezone} className="whitespace-nowrap text-kumo-default">{dateTime}</time>
      </div>
    </footer>
  )
}
