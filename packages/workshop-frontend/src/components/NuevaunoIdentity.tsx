import SiteLogo from './SiteLogo'
import { useNuevaunoBrandSpec, type NuevaunoBrandSpec } from '../hooks/useNuevaunoBrandSpec'

const CANONICAL_NAME = /^NUEVAUNO(?:\s+OS)?$/i

export function isNuevaunoIdentity(siteName: string): boolean {
  return CANONICAL_NAME.test(siteName.trim())
}

export function NuevaunoWordmark({
  size,
  spec,
  className = '',
}: {
  size: number
  spec: NuevaunoBrandSpec
  className?: string
}) {
  const { cursor, lockup } = spec.canonical
  const cursorStyle = {
    width: `${cursor.width / lockup.wordFontSizeRel}em`,
    height: `${cursor.height / lockup.wordFontSizeRel}em`,
    marginLeft: `${(lockup.markWordGap + cursor.marginLeft) / lockup.wordFontSizeRel}em`,
    background: cursor.color,
    borderRadius: cursor.cornerRadius,
    verticalAlign: cursor.verticalAlign,
    animationDuration: cursor.blink.duration,
    animationTimingFunction: cursor.blink.timing,
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap font-nuevauno ${className}`}
      style={{
        fontSize: size * lockup.wordFontSizeRel,
        fontFamily: `'${lockup.wordFont}', 'Nuevauno Mono', monospace`,
        letterSpacing: lockup.wordLetterSpacing,
        lineHeight: 1,
      }}
    >
      <span>nuevauno</span>
      <span className="nuevauno-cursor" style={cursorStyle} aria-hidden />
    </span>
  )
}

export function NuevaunoMark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <img src="https://branding.nuevauno.com/logos/nuevauno-mark.svg" alt="" width={size} height={size} className="object-contain dark:hidden" />
      <img src="https://branding.nuevauno.com/logos/nuevauno-mark-white.svg" alt="" width={size} height={size} className="hidden object-contain dark:block" />
    </span>
  )
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
  const canonical = isNuevaunoIdentity(siteName)
  const brandSpec = useNuevaunoBrandSpec(canonical)

  if (!canonical) {
    return (
      <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
        <SiteLogo size={size} className="shrink-0"><span aria-hidden /></SiteLogo>
        {!compact && <span className="truncate">{siteName}</span>}
      </span>
    )
  }

  if (!brandSpec) {
    return (
      <span
        className={className}
        style={{ display: 'inline-block', height: size, visibility: 'hidden' }}
        aria-hidden
      />
    )
  }

  const { lockup } = brandSpec.canonical

  return (
    <span className={`inline-flex min-w-0 items-center ${className}`} style={{ gap: size * lockup.markWordGap }}>
      <NuevaunoMark size={size} />
      {!compact && (
        <span className="inline-flex items-center" style={{ gap: size * lockup.markWordGap }}>
          <NuevaunoWordmark size={size} spec={brandSpec} />
          {(showOs ?? /\sOS$/i.test(siteName)) && (
            <span
              className="font-nuevauno"
              style={{
                fontSize: size * lockup.wordFontSizeRel,
                fontFamily: `'${lockup.wordFont}', 'Nuevauno Mono', monospace`,
                letterSpacing: lockup.wordLetterSpacing,
                lineHeight: 1,
              }}
            >
              OS
            </span>
          )}
        </span>
      )}
    </span>
  )
}
