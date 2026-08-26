import { useEffect, useMemo, useState } from 'react'
import type { AuthenticatedApi, BusinessSessionView, VaultCollectionView, VaultView } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from './AuthContext'
import { useI18n } from './i18n'
import { resolveSalesScope } from './SalesPage'
import NuevaunoIcon from './components/NuevaunoIcon'

export async function loadVault(api: Pick<AuthenticatedApi, 'getBusinessSession' | 'listVault'>, session: BusinessSessionView | null): Promise<VaultView | null> {
  const resolved = session ?? await api.getBusinessSession()
  const scope = resolveSalesScope(resolved)
  return scope ? api.listVault(scope.organizationId, scope.companyId) : null
}

function CollectionRow({ collection, depth, selected, onSelect }: { collection: VaultCollectionView; depth: number; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left ${selected ? 'bg-kumo-tint text-kumo-default' : 'text-kumo-subtle hover:bg-kumo-elevated hover:text-kumo-default'}`} style={{ paddingInlineStart: `${12 + depth * 16}px` }}>
    <NuevaunoIcon name="nuevauno_vault" size={17} />
    <span className="min-w-0 flex-1 truncate text-sm">{collection.name}</span>
    <span className="text-[11px]">{collection.files.length}</span>
  </button>
}

export default function VaultPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi()
  const { language, t } = useI18n()
  const [result, setResult] = useState<VaultView | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => { let alive = true; setLoading(true); setFailed(false); loadVault(authenticatedApi, businessSession).then((next) => { if (!alive) return; setResult(next); setSelectedId((current) => current ?? next?.collections[0]?.id ?? null) }).catch(() => { if (alive) setFailed(true) }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [authenticatedApi, businessSession])
  const selected = result?.collections.find((collection) => collection.id === selectedId) ?? null
  const depths = useMemo(() => {
    const byId = new Map(result?.collections.map((collection) => [collection.id, collection]) ?? [])
    return new Map((result?.collections ?? []).map((collection) => { let depth = 0, parent = collection.parentId; const seen = new Set<string>(); while (parent && !seen.has(parent)) { seen.add(parent); depth += 1; parent = byId.get(parent)?.parentId } return [collection.id, depth] }))
  }, [result])
  const download = async (fileId: string) => {
    if (!result) return
    const file = await authenticatedApi.readVaultFile(result.organizationId, result.companyId, fileId)
    const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mimeType }))
    const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url)
  }
  const formatBytes = (bytes: number) => new Intl.NumberFormat(language === 'es' ? 'es-CL' : 'en-US', { maximumFractionDigits: 1 }).format(bytes < 1024 * 1024 ? bytes / 1024 : bytes / (1024 * 1024)) + (bytes < 1024 * 1024 ? ' KB' : ' MB')

  return <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
    <header className="mb-8"><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('vault.eyebrow')}</p><h1 className="text-3xl font-normal text-kumo-default">{t('vault.title')}</h1><p className="mt-2 text-sm text-kumo-subtle">{t('vault.subtitle')}</p></header>
    {loading ? <p className="rounded-2xl border border-kumo-line bg-kumo-elevated p-6 text-sm text-kumo-subtle">{t('common.loading')}</p> : failed ? <p className="rounded-2xl border border-kumo-line bg-kumo-elevated p-6 text-sm text-kumo-danger">{t('vault.error')}</p> : !result?.collections.length ? <p className="rounded-2xl border border-kumo-line bg-kumo-elevated p-6 text-sm text-kumo-subtle">{t('vault.empty')}</p> : <div className="grid overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated md:grid-cols-[280px_1fr]">
      <aside className="border-b border-kumo-line p-3 md:border-b-0 md:border-r"><p className="px-3 pb-2 text-[11px] uppercase tracking-[0.12em] text-kumo-subtle">{t('vault.folders')}</p>{result.collections.map((collection) => <CollectionRow key={collection.id} collection={collection} depth={depths.get(collection.id) ?? 0} selected={collection.id === selectedId} onSelect={() => setSelectedId(collection.id)} />)}</aside>
      <section className="min-w-0 p-5"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-kumo-subtle">{selected?.completeName}</p><h2 className="mt-1 text-xl font-normal text-kumo-default">{selected?.name}</h2></div>{selected && selected.activeShareCount > 0 && <span className="rounded-full border border-kumo-line px-3 py-1 text-xs text-kumo-subtle">{t('vault.shared', { count: selected.activeShareCount })}</span>}</div>
        {selected?.files.length ? <div className="divide-y divide-kumo-line rounded-xl border border-kumo-line bg-kumo-base">{selected.files.map((file) => <button key={file.id} type="button" onClick={() => void download(file.id)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-kumo-elevated"><NuevaunoIcon name="documentos" size={18} /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-kumo-default">{file.name}</span><span className="mt-0.5 block text-xs text-kumo-subtle">{formatBytes(file.bytes)}</span></span><NuevaunoIcon name="download" size={16} /></button>)}</div> : <p className="rounded-xl border border-dashed border-kumo-line p-5 text-sm text-kumo-subtle">{t('vault.folderEmpty')}</p>}
        {result.shares.some((share) => share.collectionId === selected?.id && share.status === 'rotation_required') && <p className="mt-4 rounded-xl border border-[#FE4A23]/30 bg-[#FE4A23]/5 px-4 py-3 text-xs text-kumo-subtle">{t('vault.rotation')}</p>}
      </section>
    </div>}
  </div>
}
