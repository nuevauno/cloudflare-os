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

const PAGE_SIZE = 25

export function filterClients(clients: OwnerClient[], query: string): OwnerClient[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return clients
  return clients.filter((client) =>
    [client.displayName, client.subject, ...client.companies.map((company) => company.name)]
      .some((value) => value.toLocaleLowerCase().includes(normalized)))
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
  const { authenticatedApi, isAdmin, businessSession, beginSupportSession } = useAuthenticatedApi()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [targets, setTargets] = useState<SupportTargetView[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<SupportTargetView | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [supportError, setSupportError] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const clients = useMemo(() => groupSupportTargets(targets), [targets])
  const filtered = useMemo(() => filterClients(clients, query), [clients, query])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    if (businessSession?.support) {
      void navigate({ to: '/sales', replace: true })
    }
  }, [businessSession?.support, navigate])

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
      navigate({ to: '/sales', replace: true })
    } catch {
      setSupportError(true)
    } finally {
      setBusy(false)
    }
  }

  if (businessSession?.support) return null
  if (!isAdmin) return <div className="mx-auto max-w-5xl p-6 text-kumo-default"><p>{t('clients.denied')}</p></div>

  return (
    <div className="mx-auto w-full max-w-6xl p-5 text-kumo-default sm:p-8">
      <p className="text-xs uppercase tracking-[0.14em] text-[#FE4A23]">{t('clients.eyebrow')}</p>
      <h1 className="mt-2 text-3xl font-normal sm:text-4xl">{t('clients.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-kumo-subtle">{t('clients.subtitle')}</p>

      <div className="mt-7 flex items-end justify-between gap-4 border-b border-kumo-line pb-3">
        <label className="w-full max-w-md">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-kumo-subtle">{t('clients.search')}</span>
          <span className="mt-1 flex h-10 items-center gap-2 border border-kumo-line bg-kumo-base px-3">
            <NuevaunoIcon name="search" size={16} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={t('clients.searchPlaceholder')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </span>
        </label>
        <span className="shrink-0 pb-2 text-xs text-kumo-subtle">{filtered.length} {t('clients.count')}</span>
      </div>

      {loading && <p className="mt-8 text-sm text-kumo-subtle">{t('common.loading')}</p>}
      {failed && <p className="mt-8 text-sm text-[#FE4A23]">{t('clients.error')}</p>}
      {!loading && !failed && clients.length === 0 && <p className="mt-8 text-sm text-kumo-subtle">{t('clients.empty')}</p>}

      <div className="mt-4 overflow-hidden border border-kumo-line bg-kumo-elevated">
        {visible.map((client) => (
          <section key={`${client.subject}:${client.organizationId}`} className="grid gap-3 border-b border-kumo-line px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(220px,1fr)_minmax(360px,2fr)] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-kumo-line bg-kumo-base"><NuevaunoIcon name="user" size={18} /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{client.displayName}</span>
                <span className="block truncate text-xs text-kumo-subtle">{client.subject}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {client.companies.map((company) => {
                const target = targets.find((item) => item.subject === client.subject && item.organizationId === client.organizationId && item.companyId === company.id)!
                return (
                  <button key={company.id} type="button" onClick={() => { setSelected(target); setReason('') }} className="flex h-9 cursor-pointer items-center gap-2 border border-kumo-line bg-kumo-base px-3 text-xs text-kumo-default hover:border-[#FE4A23] hover:text-[#FE4A23]">
                    <NuevaunoIcon name="app" size={15} /><span>{company.name}</span><NuevaunoIcon name="next" size={13} />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      {pages > 1 && <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="h-9 border border-kumo-line px-3 text-xs disabled:opacity-40">{t('clients.previous')}</button>
        <span className="text-xs text-kumo-subtle">{page} / {pages}</span>
        <button type="button" disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="h-9 border border-kumo-line px-3 text-xs disabled:opacity-40">{t('clients.next')}</button>
      </div>}

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="support-title">
          <div className="w-full max-w-md border border-kumo-line bg-kumo-base p-5 shadow-xl">
            <h2 id="support-title" className="text-2xl font-normal">{t('clients.enterTitle')}</h2>
            <p className="mt-2 text-sm text-kumo-subtle">{selected.displayName} · {selected.companyName}</p>
            <p className="mt-1 text-sm text-kumo-subtle">{t('clients.enterHelp')}</p>
            <label className="mt-5 block text-xs uppercase tracking-[0.12em] text-kumo-subtle" htmlFor="support-reason">{t('clients.reason')}</label>
            <textarea id="support-reason" autoFocus value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full border border-kumo-line bg-kumo-elevated p-3" />
            {supportError && <p className="mt-3 text-sm text-[#FE4A23]">{t('clients.enterError')}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="border border-kumo-line px-4 py-2">{t('common.cancel')}</button>
              <button type="button" disabled={busy || reason.trim().length < 8} onClick={() => void enter()} className="bg-[#FE4A23] px-4 py-2 text-white disabled:opacity-40">{busy ? t('clients.entering') : t('clients.enterAudited')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
