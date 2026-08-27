import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { SupportTargetView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import NuevaunoIcon from './components/NuevaunoIcon'
import { useI18n } from './i18n'

export interface OwnerClient {
  subject: string
  displayName: string
  organizationId: string
  organizationName: string
  companies: Array<{ id: string; name: string }>
}

export function groupSupportTargets(targets: SupportTargetView[]): OwnerClient[] {
  const clients = new Map<string, OwnerClient>()
  for (const target of targets) {
    const key = `${target.subject}:${target.organizationId}`
    const current = clients.get(key) ?? {
      subject: target.subject,
      displayName: target.displayName,
      organizationId: target.organizationId,
      organizationName: target.organizationName,
      companies: [],
    }
    if (!current.companies.some((company) => company.id === target.companyId)) {
      current.companies.push({ id: target.companyId, name: target.companyName })
    }
    clients.set(key, current)
  }
  return [...clients.values()]
    .map((client) => ({ ...client, companies: client.companies.toSorted((a, b) => a.name.localeCompare(b.name)) }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName))
}

export default function OwnerClientsPage() {
  const { authenticatedApi, isAdmin, beginSupportSession } = useAuthenticatedApi()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [targets, setTargets] = useState<SupportTargetView[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<SupportTargetView | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [supportError, setSupportError] = useState(false)
  const clients = useMemo(() => groupSupportTargets(targets), [targets])

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    let active = true
    authenticatedApi.listSupportTargets()
      .then((value) => { if (active) setTargets(value) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authenticatedApi, isAdmin])

  const enter = async () => {
    if (!selected || reason.trim().length < 8) return
    setBusy(true)
    setSupportError(false)
    try {
      await beginSupportSession({
        targetSubject: selected.subject,
        organizationId: selected.organizationId,
        companyId: selected.companyId,
        reason: reason.trim(),
        durationMinutes: 30,
      })
      navigate({ to: '/' })
    } catch {
      setSupportError(true)
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) return <div className="mx-auto max-w-5xl p-6 text-kumo-default"><p>{t('clients.denied')}</p></div>

  return (
    <div className="mx-auto w-full max-w-6xl p-5 text-kumo-default sm:p-8">
      <p className="text-xs uppercase tracking-[0.14em] text-[#FE4A23]">{t('clients.eyebrow')}</p>
      <h1 className="mt-2 text-3xl font-normal sm:text-4xl">{t('clients.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-kumo-subtle">{t('clients.subtitle')}</p>

      {loading && <p className="mt-8 text-sm text-kumo-subtle">{t('common.loading')}</p>}
      {failed && <p className="mt-8 text-sm text-[#FE4A23]">{t('clients.error')}</p>}
      {!loading && !failed && clients.length === 0 && <p className="mt-8 text-sm text-kumo-subtle">{t('clients.empty')}</p>}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {clients.map((client) => (
          <section key={`${client.subject}:${client.organizationId}`} className="rounded-2xl border border-kumo-line bg-kumo-elevated p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-kumo-tint"><NuevaunoIcon name="user" size={20} /></span>
              <div className="min-w-0">
                <h2 className="text-xl font-normal">{client.displayName}</h2>
                <p className="truncate text-sm text-kumo-subtle">{client.subject}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-kumo-subtle">{client.organizationName}</p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {client.companies.map((company) => {
                const target = targets.find((item) => item.subject === client.subject && item.organizationId === client.organizationId && item.companyId === company.id)!
                return (
                  <div key={company.id} className="flex items-center justify-between gap-3 rounded-xl border border-kumo-line bg-kumo-base px-3 py-3">
                    <span className="flex min-w-0 items-center gap-2"><NuevaunoIcon name="app" /><span className="truncate text-sm">{company.name}</span></span>
                    <button type="button" onClick={() => { setSelected(target); setReason('') }} className="shrink-0 rounded-xl border border-[#FE4A23] px-3 py-2 text-sm text-[#FE4A23]">{t('clients.enter')}</button>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="support-title">
          <div className="w-full max-w-md rounded-2xl border border-kumo-line bg-kumo-base p-5 shadow-xl">
            <h2 id="support-title" className="text-2xl font-normal">{t('clients.enterTitle')}</h2>
            <p className="mt-2 text-sm text-kumo-subtle">{selected.displayName} · {selected.companyName}</p>
            <p className="mt-1 text-sm text-kumo-subtle">{t('clients.enterHelp')}</p>
            <label className="mt-5 block text-xs uppercase tracking-[0.12em] text-kumo-subtle" htmlFor="support-reason">{t('clients.reason')}</label>
            <textarea id="support-reason" autoFocus value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-kumo-line bg-kumo-elevated p-3" />
            {supportError && <p className="mt-3 text-sm text-[#FE4A23]">{t('clients.enterError')}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-kumo-line px-4 py-2">{t('common.cancel')}</button>
              <button type="button" disabled={busy || reason.trim().length < 8} onClick={() => void enter()} className="rounded-xl bg-[#FE4A23] px-4 py-2 text-white disabled:opacity-40">{busy ? t('clients.entering') : t('clients.enterAudited')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
