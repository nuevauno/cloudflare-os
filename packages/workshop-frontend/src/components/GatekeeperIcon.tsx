import NuevaunoIcon, { type NuevaunoIconName } from './NuevaunoIcon'

const VENDOR_ICONS: Record<string, NuevaunoIconName> = {
  cloudflare: 'cloud',
  context: 'knowledge',
  custom: 'connections',
  email: 'connections',
  github: 'code',
  google: 'globe',
  linear: 'list',
  mcp: 'connections',
  mcp_portal: 'connections',
  scheduler: 'automation',
  supabase: 'database',
}

export function GatekeeperIcon({
  vendorId,
  fallbackText: _fallbackText,
  logoUrl: _logoUrl,
  color: _color,
  size = 16,
  className = 'h-8 w-8 rounded-lg',
}: {
  vendorId?: string
  /** Text whose first letter is shown when no logo is available (e.g. the resource title). */
  fallbackText?: string
  logoUrl?: string
  /**
   * The vendor's own background colour, from `VendorDescription.color`.
   *
   * Applied only behind a logo, never behind the initial fallback. Several vendor logos are
   * single-colour glyphs drawn for a specific backdrop — MCP's is white — so on the neutral tint they
   * disappear. An initial is text in a theme colour and reads correctly on the tint already.
   */
  color?: string
  size?: number
  className?: string
}) {
  const normalizedVendor = (vendorId || '').toLowerCase()
  const icon = VENDOR_ICONS[normalizedVendor]
    ?? (normalizedVendor.includes('schedule') ? 'automation' : undefined)
    ?? (normalizedVendor.includes('context') ? 'knowledge' : undefined)
    ?? (normalizedVendor.includes('custom') ? 'connections' : undefined)
    ?? 'app'

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${className}`}
      style={{ backgroundColor: 'var(--color-kumo-tint)' }}
    >
      <NuevaunoIcon name={icon} size={size} />
    </div>
  )
}
