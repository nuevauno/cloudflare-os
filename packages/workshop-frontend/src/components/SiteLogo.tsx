import { useEffect, useState, type ReactNode } from 'react'
import { useServerConfig } from '../ServerConfigContext'

const NUEVAUNO_ANIMATED_MARK = 'https://branding.nuevauno.com/logos/nuevauno-mark.anim.svg'

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
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src, serverConfig])

  if (!src || failed) return children
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className ?? ''}`}
      onError={() => setFailed(true)}
    />
  )
}
