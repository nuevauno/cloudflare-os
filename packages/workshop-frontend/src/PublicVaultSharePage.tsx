import { useEffect, useState } from 'react'
import type { PublicVaultShareView } from '@gadgets/workshop-shared/api'
import { useRpcStub } from './RpcContext'
import { useI18n } from './i18n'
import NuevaunoIcon from './components/NuevaunoIcon'

export default function PublicVaultSharePage({ token }: { token: string }) {
  const api = useRpcStub()
  const { language, t } = useI18n()
  const [pin, setPin] = useState('')
  const [share, setShare] = useState<PublicVaultShareView | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow,noarchive'; document.head.append(meta)
    return () => meta.remove()
  }, [])
  const open = async () => {
    setLoading(true); setFailed(false)
    try { setShare(await api.openPublicVaultShare(token, pin)) } catch { setFailed(true) } finally { setLoading(false) }
  }
  const download = async (fileId: string) => {
    try {
      const file = await api.readPublicVaultFile(token, pin, fileId)
      const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mimeType }))
      const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url)
    } catch { setFailed(true) }
  }
  const formatBytes = (bytes: number) => new Intl.NumberFormat(language === 'es' ? 'es-CL' : 'en-US', { maximumFractionDigits: 1 }).format(bytes < 1024 * 1024 ? bytes / 1024 : bytes / (1024 * 1024)) + (bytes < 1024 * 1024 ? ' KB' : ' MB')
  return <div className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8"><p className="text-[11px] uppercase tracking-[0.14em] text-[#FE4A23]">{t('vault.eyebrow')}</p><h1 className="mt-2 text-3xl font-normal text-kumo-default">{share?.label || share?.collectionName || t('vault.publicTitle')}</h1>{!share ? <div className="mt-8 rounded-2xl border border-kumo-line bg-kumo-elevated p-6"><p className="text-sm text-kumo-subtle">{t('vault.publicPrompt')}</p><div className="mt-4 flex gap-3"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className="min-w-0 flex-1 rounded-xl border border-kumo-line bg-kumo-base px-4 py-3 text-lg tracking-[0.2em] text-kumo-default" /><button type="button" disabled={pin.length !== 6 || loading} onClick={() => void open()} className="cursor-pointer rounded-xl bg-[#FE4A23] px-5 py-3 text-sm font-normal text-white disabled:opacity-50">{t('vault.open')}</button></div>{failed && <p className="mt-3 text-sm text-kumo-danger">{t('vault.publicError')}</p>}</div> : <div className="mt-8 divide-y divide-kumo-line overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated">{share.files.map((file) => <button key={file.id} type="button" disabled={!share.allowDownload} onClick={() => void download(file.id)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left disabled:cursor-default"><NuevaunoIcon name="documentos" size={18} /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-kumo-default">{file.name}</span><span className="block text-xs text-kumo-subtle">{formatBytes(file.bytes)}</span></span>{share.allowDownload && <NuevaunoIcon name="download" size={16} />}</button>)}{!share.allowDownload && <p className="p-4 text-sm text-kumo-subtle">{t('vault.downloadDisabled')}</p>}</div>}</div>
}
