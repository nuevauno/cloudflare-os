import { useEffect, useState, type ReactNode } from 'react'
import { useServerConfig } from '../ServerConfigContext'

const NUEVAUNO_ANIMATED_MARK = 'https://branding.nuevauno.com/logos/nuevauno-mark.anim.svg'
const NUEVAUNO_DARK_MARK = 'https://branding.nuevauno.com/logos/nuevauno-mark-white.svg'

export default function SiteLogo({
  size,
  className,
  srcOverride,
  children,
}: {
  size: number
  className?: string
  srcOverride?: string | null
  children: ReactNode
}) {
  const serverConfig = useServerConfig()
  const configuredUrl = serverConfig?.siteLogo?.url
  const src = srcOverride === undefined ? configuredUrl || NUEVAUNO_ANIMATED_MARK : srcOverride || NUEVAUNO_ANIMATED_MARK
  const usesCanonicalMark = src === NUEVAUNO_ANIMATED_MARK
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src, serverConfig])

  if (!src || failed) return children
  const image = (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className ?? ''}`}
      onError={() => setFailed(true)}
    />
  )
  if (!usesCanonicalMark) return image
  return (
    <span className="inline-flex shrink-0">
      <img src={NUEVAUNO_ANIMATED_MARK} alt="" width={size} height={size} className={`object-contain dark:hidden ${className ?? ''}`} onError={() => setFailed(true)} />
      <img src={NUEVAUNO_DARK_MARK} alt="" width={size} height={size} className={`hidden object-contain dark:block ${className ?? ''}`} onError={() => setFailed(true)} />
    </span>
  )
}
