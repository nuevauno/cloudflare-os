import { useEffect, useMemo, useState } from 'react'
import type { AccountingLocalizationView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import NuevaunoIcon from './components/NuevaunoIcon'
import { useI18n } from './i18n'

const COUNTRIES = [
  ['AR', 'Argentina'], ['BO', 'Bolivia'], ['BR', 'Brasil'], ['CL', 'Chile'], ['CO', 'Colombia'], ['CR', 'Costa Rica'],
  ['DO', 'República Dominicana'], ['EC', 'Ecuador'], ['SV', 'El Salvador'], ['GT', 'Guatemala'], ['HN', 'Honduras'],
  ['MX', 'México'], ['NI', 'Nicaragua'], ['PA', 'Panamá'], ['PY', 'Paraguay'], ['PE', 'Perú'], ['US', 'Estados Unidos'],
  ['UY', 'Uruguay'], ['VE', 'Venezuela'], ['CA', 'Canadá'], ['ES', 'España'], ['GB', 'Reino Unido'],
] as const

export default function AccountingPage() {
  const { authenticatedApi, businessSession, refreshBusinessSession } = useAuthenticatedApi()
  const { t } = useI18n()
  const active = useMemo(() => businessSession?.organizations.flatMap((organization) => organization.companies.map((company) => ({ organization, company }))).find(({ company }) => company.id === businessSession.activeCompanyId), [businessSession])
  const [localization, setLocalization] = useState<AccountingLocalizationView | null>(null)
  const [country, setCountry] = useState('CL')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) { setLoading(false); return }
    let alive = true
    setLoading(true); setError(''); setCountry(active.company.countryCode ?? 'CL')
    authenticatedApi.getAccountingLocalization(active.organization.id, active.company.id)
      .then((value) => { if (alive) { setLocalization(value); if (value) setCountry(value.countryCode) } })
      .catch(() => { if (alive) setError(t('accounting.loadError')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [active?.organization.id, active?.company.id, authenticatedApi, t])

  const install = async () => {
    if (!active) return
    setBusy(true); setError('')
    try {
      const value = await authenticatedApi.installAccountingLocalization({ organizationId: active.organization.id, companyId: active.company.id, countryCode: country })
      setLocalization(value)
      await refreshBusinessSession()
    } catch (reason) {
      setError(reason instanceof Error && reason.message.includes('accounting_country_locked') ? t('accounting.locked') : t('accounting.installError'))
    } finally { setBusy(false) }
  }

  if (!active) return <div className="mx-auto max-w-5xl p-6 text-kumo-subtle">{t('accounting.noCompany')}</div>
  return <div className="mx-auto w-full max-w-6xl p-5 text-kumo-default sm:p-8">
    <p className="text-xs uppercase tracking-[0.14em] text-[#FE4A23]">{t('accounting.eyebrow')}</p>
    <h1 className="mt-2 text-3xl font-normal sm:text-4xl">{t('accounting.title')}</h1>
    <p className="mt-2 max-w-2xl text-sm text-kumo-subtle">{t('accounting.subtitle')}</p>
    <section className="mt-8 rounded-2xl border border-kumo-line bg-kumo-elevated p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.12em] text-kumo-subtle">{active.company.displayName}</p><h2 className="mt-1 text-xl font-normal">{localization?.packageCode ?? t('accounting.notInstalled')}</h2>{localization && <p className="mt-1 text-sm text-kumo-subtle">{t('accounting.version')} {localization.packageVersion}</p>}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="text-xs uppercase tracking-[0.12em] text-kumo-subtle">{t('accounting.country')}<select value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1 block h-11 min-w-56 rounded-xl border border-kumo-line bg-kumo-base px-3 text-sm text-kumo-default">{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><button type="button" disabled={busy || loading || active.company.access === 'read'} onClick={() => void install()} className="h-11 rounded-xl bg-[#FE4A23] px-4 text-sm text-white disabled:opacity-40">{busy ? t('accounting.installing') : localization ? t('accounting.update') : t('accounting.install')}</button></div>
      </div>
      {error && <p className="mt-4 text-sm text-[#FE4A23]" role="alert">{error}</p>}
    </section>
    {localization && <div className="mt-5 grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-kumo-line bg-kumo-elevated p-5 lg:col-span-2"><div className="flex items-center gap-2"><NuevaunoIcon name="list" /><h2 className="text-lg font-normal">{t('accounting.accounts')}</h2></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{localization.accounts.map((account) => <div key={account.id} className="rounded-xl border border-kumo-line bg-kumo-base px-3 py-2"><span className="text-xs text-[#FE4A23]">{account.code}</span><p className="text-sm">{account.name}</p></div>)}</div></section>
      <div className="space-y-4"><section className="rounded-2xl border border-kumo-line bg-kumo-elevated p-5"><h2 className="text-lg font-normal">{t('accounting.journals')}</h2><div className="mt-3 space-y-2">{localization.journals.map((journal) => <p key={journal.id} className="text-sm"><span className="text-[#FE4A23]">{journal.code}</span> · {journal.name}</p>)}</div></section><section className="rounded-2xl border border-kumo-line bg-kumo-elevated p-5"><h2 className="text-lg font-normal">{t('accounting.taxes')}</h2><div className="mt-3 space-y-2">{localization.taxes.length ? localization.taxes.map((tax) => <p key={tax.id} className="text-sm">{tax.name} · {(tax.rateBasisPoints / 100).toLocaleString()}%</p>) : <p className="text-sm text-kumo-subtle">{t('accounting.taxesConfigurable')}</p>}</div></section></div>
    </div>}
  </div>
}
