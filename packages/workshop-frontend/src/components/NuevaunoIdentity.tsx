import SiteLogo from './SiteLogo'

const CANONICAL_NAME = /^NUEVAUNO(?:\s+OS)?$/i

export function isNuevaunoIdentity(siteName: string): boolean {
  return CANONICAL_NAME.test(siteName.trim())
}

export function NuevaunoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      <span className="font-nuevauno tracking-[-0.04em]">nuevauno</span>
      <span className="nuevauno-cursor" aria-hidden />
    </span>
  )
}

export function NuevaunoMark({ size, className = '' }: { size: number; className?: string }) {
  return <img src="https://branding.nuevauno.com/logos/nuevauno-mark.anim.svg" alt="" width={size} height={size} className={`object-contain ${className}`} />
}

export default function NuevaunoIdentity({
  siteName,
  size = 20,
  compact = false,
  showOs,
  className = '',
}: {
  siteName: string
  size?: number
  compact?: boolean
  showOs?: boolean
  className?: string
}) {
  if (!isNuevaunoIdentity(siteName)) {
    return (
      <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
        <SiteLogo size={size} className="shrink-0"><span aria-hidden /></SiteLogo>
        {!compact && <span className="truncate">{siteName}</span>}
      </span>
    )
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <SiteLogo size={size} className="shrink-0"><span aria-hidden /></SiteLogo>
      {!compact && (
        <span className="inline-flex items-baseline gap-2">
          <NuevaunoWordmark />
          {(showOs ?? /\sOS$/i.test(siteName)) && <span className="font-nuevauno tracking-[-0.04em]">OS</span>}
        </span>
      )}
    </span>
  )
}
