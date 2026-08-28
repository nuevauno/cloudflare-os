import { Link, useRouterState } from '@tanstack/react-router'
import { Tooltip } from '@cloudflare/kumo'
import UserMenu from '../UserMenu'
import { useTheme } from '../../ThemeContext'
import type { ThemeMode } from '../../theme'
import { useI18n, type MessageKey } from '../../i18n'
import NuevaunoIcon, { type NuevaunoIconName } from '../NuevaunoIcon'
import { SIDEBAR_UTILITY_CLASS } from './businessChrome'

const THEME_SEQUENCE: ThemeMode[] = ['system', 'light', 'dark']
const THEME_KEYS: Record<ThemeMode, MessageKey> = {
  system: 'theme.system', light: 'theme.light', dark: 'theme.dark',
}

function nextThemeMode(mode: ThemeMode): ThemeMode {
  return THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(mode) + 1) % THEME_SEQUENCE.length]
}

function ThemeModeButton() {
  const { themeMode, resolvedThemeMode, setThemeMode } = useTheme()
  const { t } = useI18n()
  const label = themeMode === 'system'
    ? t('theme.systemResolved', { mode: t(THEME_KEYS[resolvedThemeMode]) })
    : t(THEME_KEYS[themeMode])
  const nextMode = nextThemeMode(themeMode)
  const iconName: NuevaunoIconName = `theme_${themeMode}`

  return (
    <Tooltip
      content={t('theme.switch', { current: label, next: t(THEME_KEYS[nextMode]) })}
      render={(
        <button
          type="button"
          aria-label={t('theme.switch', { current: label, next: t(THEME_KEYS[nextMode]) })}
          onClick={() => setThemeMode(nextMode)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center text-kumo-inactive transition-colors hover:bg-kumo-tint hover:text-kumo-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-ring focus-visible:ring-offset-2 focus-visible:ring-offset-kumo-elevated"
        >
          <NuevaunoIcon name={iconName} size={15} />
        </button>
      )}
    />
  )
}

// Bottom strip on the sidebar: tiny iconography for connections, theme, and the user menu. Mirrors
// the very low-chrome bottom row in the reference design and surfaces Profile / Providers / Admin
// from the user-menu dropdown rather than duplicating them as separate icons.
function StripLink({
  to,
  label,
  children,
}: {
  to: '/gatekeepers'
  label: string
  children: React.ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = pathname === to
  return (
    <Tooltip content={label}>
      <Link
        to={to}
        aria-label={label}
        className={[
          'flex h-8 w-8 items-center justify-center transition-colors',
          active
            ? 'bg-kumo-fill text-kumo-brand'
            : 'text-kumo-inactive hover:bg-kumo-tint hover:text-kumo-default',
        ].join(' ')}
      >
        {children}
      </Link>
    </Tooltip>
  )
}

export default function SidebarUtilityStrip({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useI18n()
  return (
    <div
      className={[
        // shrink-0 + solid base so the strip is visually pinned above the scrolling rail body
        // and content can't bleed through it. Flat treatment — no top shadow.
        SIDEBAR_UTILITY_CLASS,
        collapsed ? 'flex-col justify-center gap-2 px-1.5' : '',
      ].join(' ')}
    >
      <StripLink to="/gatekeepers" label={t('utility.gatekeepers')}>
        <NuevaunoIcon name="connections" size={15} />
      </StripLink>
      <div className={collapsed ? 'flex flex-col items-center gap-2' : 'ml-auto flex items-center gap-1'}>
        <ThemeModeButton />
        <UserMenu />
      </div>
    </div>
  )
}
