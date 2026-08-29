import { useEffect, useState } from 'react'
import type { AgentRunListView, AgentRunView, AuthenticatedApi, BusinessSessionView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import { resolveSalesScope } from './SalesPage'
import NuevaunoIcon from './components/NuevaunoIcon'

export async function loadAgentRuns(
  api: Pick<AuthenticatedApi, 'getBusinessSession' | 'listAgentRuns'>,
  session: BusinessSessionView | null,
): Promise<AgentRunListView | null> {
  const resolved = session ?? await api.getBusinessSession()
  const scope = resolveSalesScope(resolved)
  return scope ? api.listAgentRuns(scope.organizationId, scope.companyId, 100) : null
}

const stateKey: Record<AgentRunView['state'], 'kodo.state.queued' | 'kodo.state.running' | 'kodo.state.succeeded' | 'kodo.state.failed' | 'kodo.state.cancelled'> = {
  queued: 'kodo.state.queued', running: 'kodo.state.running', succeeded: 'kodo.state.succeeded',
  failed: 'kodo.state.failed', cancelled: 'kodo.state.cancelled',
}

export default function KodoPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, timeZone, hourCycle, t } = useI18n()
  const [result, setResult] = useState<AgentRunListView | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true; setLoading(true); setFailed(false)
    loadAgentRuns(authenticatedApi, businessSession).then((value) => { if (alive) setResult(value) })
      .catch(() => { if (alive) { setResult(null); setFailed(true) } }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [authenticatedApi, businessSession])
  const date = (value: string) => new Intl.DateTimeFormat(language === 'es' ? 'es-CL' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone, hour12: hourCycle === 'h12',
  }).format(new Date(value))
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
    <header className="mb-8"><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('kodo.eyebrow')}</p><h1 className="text-3xl font-normal text-kumo-default">{t('kodo.title')}</h1><p className="mt-2 text-sm text-kumo-subtle">{t('kodo.subtitle')}</p></header>
    <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">
      {loading ? <p className="p-6 text-sm text-kumo-subtle">{t('common.loading')}</p> : failed ? <p className="p-6 text-sm text-kumo-danger">{t('kodo.error')}</p> : result?.runs.length ? result.runs.map((run) => <article key={run.id} className="border-b border-kumo-line last:border-b-0">
        <button type="button" onClick={() => setExpanded(expanded === run.id ? null : run.id)} className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[40px_1fr_auto] sm:items-center"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kumo-line bg-kumo-base"><NuevaunoIcon name="nuevauno_kodo" size={18} /></span><span className="min-w-0"><span className="block text-sm text-kumo-default">{run.number ? `${run.number} · ` : ''}{run.name}</span><span className="mt-1 block text-xs text-kumo-subtle">{date(run.completedAt ?? run.createdAt)}{run.toolKey ? ` · ${run.toolKey}` : ''}</span></span><span className={run.state === 'failed' ? 'text-xs text-kumo-danger' : 'text-xs text-kumo-subtle'}>{t(stateKey[run.state])}</span></button>
        {expanded === run.id && <div className="border-t border-kumo-line bg-kumo-base px-4 py-3 sm:pl-16">{run.events?.length ? run.events.map((event) => <div key={event.id} className="grid gap-1 border-b border-kumo-line py-2 text-xs last:border-b-0 sm:grid-cols-[auto_1fr_auto]"><span className="text-[#FE4A23]">{event.eventType}</span><span className="text-kumo-default">{event.message ?? t('kodo.event')}</span><span className="text-kumo-subtle">{date(event.occurredAt)}</span></div>) : <p className="py-2 text-xs text-kumo-subtle">{t('kodo.noEvents')}</p>}</div>}
      </article>) : <p className="p-6 text-sm text-kumo-subtle">{t('kodo.empty')}</p>}
    </div>
  </div>
}
