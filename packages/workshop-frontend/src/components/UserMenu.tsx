import { useNavigate } from '@tanstack/react-router'
import { DropdownMenu } from '@cloudflare/kumo'
import { useAuthenticatedApi } from '../AuthContext'
import { useAvatar } from '../useAvatar'
import { MENU_CONTENT, MENU_ITEM, MENU_ITEM_DANGER, MENU_POSITIONER_STYLE } from './menuStyles'
import { useI18n } from '../i18n'
import { useState } from 'react'
import type { SupportTargetView } from '@gadgets/workshop-shared/api'
import { hashPassword } from '../passwordHash'

export default function UserMenu() {
  const { authenticatedApi, logout, currentUser, isAdmin, beginSupportSession } = useAuthenticatedApi()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportTargets, setSupportTargets] = useState<SupportTargetView[]>([])
  const [supportTarget, setSupportTarget] = useState('')
  const [supportReason, setSupportReason] = useState('')
  const [supportBusy, setSupportBusy] = useState(false)
  const [supportError, setSupportError] = useState('')
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisionBusy, setProvisionBusy] = useState(false)
  const [provisionError, setProvisionError] = useState('')
  const [provision, setProvision] = useState({ username: '', email: '', displayName: '', password: '', organizationSlug: '', organizationName: '', companySlug: '', companyLegalName: '', companyDisplayName: '' })

  const openSupport = async () => {
    setSupportError('')
    try {
      const targets = await authenticatedApi.listSupportTargets()
      setSupportTargets(targets)
      setSupportTarget(targets[0] ? `${targets[0].subject}|${targets[0].organizationId}|${targets[0].companyId}` : '')
      setSupportOpen(true)
    } catch {
      setSupportError('No pudimos cargar los clientes. Inténtalo nuevamente.')
      setSupportOpen(true)
    }
  }

  const startSupport = async () => {
    const [targetSubject, organizationId, companyId] = supportTarget.split('|')
    if (!targetSubject || !organizationId || !companyId || supportReason.trim().length < 8) return
    setSupportBusy(true)
    setSupportError('')
    try {
      await beginSupportSession({ targetSubject, organizationId, companyId, reason: supportReason.trim(), durationMinutes: 30 })
      setSupportOpen(false)
      setSupportReason('')
      navigate({ to: '/' })
    } catch {
      setSupportError('No pudimos iniciar el acceso. Revisa el cliente y el motivo.')
    } finally {
      setSupportBusy(false)
    }
  }

  const createClient = async () => {
    if (!provision.username || provision.password.length < 8) return
    setProvisionBusy(true)
    setProvisionError('')
    try {
      await authenticatedApi.provisionBusinessOwner({
        username: provision.username, ...(provision.email ? { email: provision.email } : {}),
        displayName: provision.displayName, passwordHash: await hashPassword(provision.username, provision.password),
        organizationSlug: provision.organizationSlug, organizationName: provision.organizationName,
        companySlug: provision.companySlug, companyLegalName: provision.companyLegalName,
        ...(provision.companyDisplayName ? { companyDisplayName: provision.companyDisplayName } : {}),
      })
      setProvisionOpen(false)
      setProvision({ username: '', email: '', displayName: '', password: '', organizationSlug: '', organizationName: '', companySlug: '', companyLegalName: '', companyDisplayName: '' })
    } catch {
      setProvisionError('No pudimos crear el cliente. Revisa los datos o si el usuario ya existe.')
    } finally {
      setProvisionBusy(false)
    }
  }

  const avatarUrl = useAvatar(authenticatedApi, currentUser?.id)

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <>
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            className="flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-kumo-tint transition-colors hover:bg-kumo-fill md:h-7 md:w-7"
            title={t('menu.open')}
            aria-label={t('menu.open')}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-normal text-kumo-strong">{initials}</span>
            )}
          </button>
        }
      />
      <DropdownMenu.Content className={MENU_CONTENT} style={MENU_POSITIONER_STYLE}>
        <DropdownMenu.Item
          onClick={() => navigate({ to: '/profile' })}
          className={MENU_ITEM}
        >
          {t('menu.profile')}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onClick={() => navigate({ to: '/providers' })}
          className={MENU_ITEM}
        >
          {t('menu.providers')}
        </DropdownMenu.Item>
        {isAdmin && (
          <DropdownMenu.Item onClick={() => void openSupport()} className={MENU_ITEM}>
            Entrar a un cliente
          </DropdownMenu.Item>
        )}
        {isAdmin && (
          <DropdownMenu.Item onClick={() => setProvisionOpen(true)} className={MENU_ITEM}>
            Crear cliente
          </DropdownMenu.Item>
        )}
        {isAdmin && (
          <DropdownMenu.Item
            onClick={() => navigate({ to: '/admin' })}
            className={MENU_ITEM}
          >
            {t('menu.admin')}
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          variant="danger"
          onClick={logout}
          className={MENU_ITEM_DANGER}
        >
          {t('menu.signOut')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
    {supportOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Entrar a un cliente">
        <div className="w-full max-w-md rounded-2xl border border-kumo-line bg-kumo-base p-5 text-kumo-default shadow-xl">
          <h2 className="text-2xl">Entrar a un cliente</h2>
          <p className="mt-1 text-sm text-kumo-subtle">El acceso dura 30 minutos, muestra una franja permanente y registra todas tus acciones.</p>
          <label className="mt-5 block text-xs uppercase tracking-[0.12em] text-kumo-subtle" htmlFor="support-target">Cliente y empresa</label>
          <select id="support-target" value={supportTarget} onChange={(event) => setSupportTarget(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-kumo-line bg-kumo-elevated px-3">
            {supportTargets.map((target) => (
              <option key={`${target.subject}:${target.companyId}`} value={`${target.subject}|${target.organizationId}|${target.companyId}`}>
                {target.displayName} · {target.companyName}
              </option>
            ))}
          </select>
          <label className="mt-4 block text-xs uppercase tracking-[0.12em] text-kumo-subtle" htmlFor="support-reason">Motivo</label>
          <textarea id="support-reason" value={supportReason} onChange={(event) => setSupportReason(event.target.value)} placeholder="Ejemplo: revisión solicitada por Piero" className="mt-1 min-h-24 w-full rounded-xl border border-kumo-line bg-kumo-elevated p-3" />
          {supportError && <p className="mt-3 text-sm text-[#FE4A23]" role="alert">{supportError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setSupportOpen(false)} className="rounded-xl border border-kumo-line px-4 py-2">Cancelar</button>
            <button type="button" disabled={supportBusy || supportReason.trim().length < 8 || !supportTarget} onClick={() => void startSupport()} className="rounded-xl bg-[#FE4A23] px-4 py-2 text-white disabled:opacity-40">
              {supportBusy ? 'Entrando…' : 'Entrar con auditoría'}
            </button>
          </div>
        </div>
      </div>
    )}
    {provisionOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Crear cliente">
        <div className="my-auto w-full max-w-xl rounded-2xl border border-kumo-line bg-kumo-base p-5 text-kumo-default shadow-xl">
          <h2 className="text-2xl">Crear cliente</h2>
          <p className="mt-1 text-sm text-kumo-subtle">Crea la identidad propietaria, su organización y la primera empresa en una sola operación.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {([
              ['username', 'Usuario', 'piero'], ['email', 'Correo', 'piero@demo.com'],
              ['displayName', 'Nombre', 'Piero'], ['password', 'Contraseña temporal', ''],
              ['organizationSlug', 'ID de organización', 'piero'], ['organizationName', 'Organización', 'Empresas Piero'],
              ['companySlug', 'ID de empresa', 'rng'], ['companyLegalName', 'Razón social', 'Reciclaje Norte Grande'],
              ['companyDisplayName', 'Nombre visible', 'RNG'],
            ] as const).map(([key, label, placeholder]) => (
              <label key={key} className={key === 'companyDisplayName' ? 'sm:col-span-2' : ''}>
                <span className="text-xs uppercase tracking-[0.12em] text-kumo-subtle">{label}</span>
                <input type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'} value={provision[key]} placeholder={placeholder} onChange={(event) => setProvision((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-kumo-line bg-kumo-elevated px-3" />
              </label>
            ))}
          </div>
          {provisionError && <p className="mt-3 text-sm text-[#FE4A23]" role="alert">{provisionError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setProvisionOpen(false)} className="rounded-xl border border-kumo-line px-4 py-2">Cancelar</button>
            <button type="button" disabled={provisionBusy || provision.password.length < 8} onClick={() => void createClient()} className="rounded-xl bg-[#FE4A23] px-4 py-2 text-white disabled:opacity-40">
              {provisionBusy ? 'Creando…' : 'Crear cliente'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
