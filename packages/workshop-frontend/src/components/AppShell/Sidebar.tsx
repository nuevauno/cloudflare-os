import { Link } from '@tanstack/react-router'
import { useSiteName } from '../../ServerConfigContext'
import NuevaunoIdentity from '../NuevaunoIdentity'
import { useGatekeeperApps } from '../../useGatekeeperApps'
import { openCommandPalette } from './commandPaletteBus'
import SidebarItem from './SidebarItem'
import {
  SidebarWorkspacesProvider,
  SidebarWorkspacesTools,
  SidebarWorkspacesLists,
} from './SidebarWorkspaces'
import SidebarUtilityStrip from './SidebarUtilityStrip'
import { useI18n } from '../../i18n'
import NuevaunoIcon from '../NuevaunoIcon'
import { useAuthenticatedApi } from '../../AuthContext'
import { useEffect, useState } from 'react'
import { resolveSalesScope } from '../../SalesPage'

/**
 * The persistent left rail. Three pinned regions sandwich a single scrolling region of lists, so
 * the user can always reach Search, primary nav, and the bottom utility strip no matter how many
 * workspaces they have.
 *
 * Layout (top → bottom):
 *   • brand row                            pinned
 *   • primary nav (Home, Workspaces, …)    pinned
 *   • workspace tools (⌘K search)          pinned
 *   • Favorites / Recent workspaces        SCROLLS
 *   • utility strip (plug, avatar)         pinned
 */
export default function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const siteName = useSiteName()
  const { t } = useI18n()
  const { authenticatedApi, isAdmin, businessSession } = useAuthenticatedApi()
  const supportMode = Boolean(businessSession?.support)
  const [posEnabled,setPosEnabled]=useState(false)
  useEffect(()=>{const scope=resolveSalesScope(businessSession);if(!scope){setPosEnabled(false);return}authenticatedApi.posLoadData(scope.organizationId,scope.companyId).then(d=>setPosEnabled(d.entitled)).catch(()=>setPosEnabled(false))},[authenticatedApi,businessSession])
  // Gatekeeper-served management apps the user can reach now (one per gatekeeper that provides a UI
  // and is connected / enabled for everyone). Disabled or not-yet-connected ones aren't returned, so
  // they simply don't appear. The set is fully dynamic — no gatekeeper is hardcoded.
  const gatekeeperApps = useGatekeeperApps()

  return (
    <aside
      aria-label={t('nav.primary')}
      className={[
        // Sidebar is the app chrome: a hair greyer than the (lighter) content canvas so the two
        // surfaces read as distinct without a heavy divider.
        'flex h-full flex-col border-r border-kumo-line bg-kumo-elevated',
        collapsed ? 'w-[56px]' : 'w-[min(320px,100vw)] md:w-[260px]',
        'shrink-0 transition-[width] duration-200 ease-out',
      ].join(' ')}
    >
      {/* Brand row */}
      <div
        className={[
          'flex h-16 shrink-0 items-center border-b border-kumo-line',
          collapsed ? 'justify-center px-1.5' : 'justify-between gap-2 px-3',
        ].join(' ')}
      >
        <Link to="/" aria-label={siteName} className="flex min-w-0 items-center gap-2">
          <NuevaunoIdentity siteName={siteName} size={30} compact={collapsed} showOs={false} className="text-[18px] leading-7 text-kumo-default" />
        </Link>
        {!collapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => openCommandPalette()}
              aria-label={t('nav.search')}
              title={`${t('nav.search')} (⌘K)`}
              className="press flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-kumo-inactive transition-colors hover:bg-kumo-tint hover:text-kumo-default"
            >
              <NuevaunoIcon name="search" size={15} />
            </button>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={t('nav.collapse')}
              title={t('nav.collapse')}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-kumo-inactive transition-colors hover:bg-kumo-tint hover:text-kumo-default"
            >
              <NuevaunoIcon name="sidebar" size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Expand affordance when collapsed — placed just under the logo for discoverability. */}
      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={t('nav.expand')}
          title={t('nav.expand')}
          className="mx-auto mt-2 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-kumo-inactive transition-colors hover:bg-kumo-tint hover:text-kumo-default"
        >
          <NuevaunoIcon name="sidebar" size={15} className="rotate-180" />
        </button>
      )}

      <SidebarWorkspacesProvider>
        {/* Pinned top stack. shrink-0 keeps it from squishing when the lists below grow. */}
        <div className="flex shrink-0 flex-col gap-3 pt-3">
          {/* Primary nav */}
          <nav className="flex flex-col gap-0.5 px-2">
            {!supportMode && <SidebarItem
              to="/"
              label={t('nav.home')}
              icon={<NuevaunoIcon name="base" />}
              collapsed={collapsed}
            />}
            {!supportMode && <SidebarItem
              to="/workspaces"
              label={t('nav.workspaces')}
              icon={<NuevaunoIcon name="project" />}
              collapsed={collapsed}
            />}
            {!supportMode && <SidebarItem
              to="/blueprints"
              label={t('nav.blueprints')}
              icon={<NuevaunoIcon name="automation" />}
              collapsed={collapsed}
            />}
            {!supportMode && <SidebarItem
              to="/outputs"
              label={t('nav.outputs')}
              icon={<NuevaunoIcon name="documentos" />}
              collapsed={collapsed}
            />}
            {isAdmin && (
              <SidebarItem
                to="/clients"
                label={t('nav.clients')}
                icon={<NuevaunoIcon name="contacts" />}
                collapsed={collapsed}
              />
            )}
            <SidebarItem
              to="/sales"
              label={t('nav.sales')}
              icon={<NuevaunoIcon name="sale" />}
              collapsed={collapsed}
            />
            {posEnabled && <SidebarItem to="/pos" label="Punto de venta" icon={<NuevaunoIcon name="point_of_sale" />} collapsed={collapsed} />}
            <SidebarItem
              to="/collections"
              label={t('nav.collections')}
              icon={<NuevaunoIcon name="nuevauno_billing" />}
              collapsed={collapsed}
            />
            <SidebarItem
              to="/accounting"
              label={t('nav.accounting')}
              icon={<NuevaunoIcon name="chart" />}
              collapsed={collapsed}
            />
            <SidebarItem
              to="/certificates"
              label={t('nav.certificates')}
              icon={<NuevaunoIcon name="nuevauno_certificates" />}
              collapsed={collapsed}
            />
            <SidebarItem
              to="/dispatch"
              label={t('nav.dispatch')}
              icon={<NuevaunoIcon name="nuevauno_dte" />}
              collapsed={collapsed}
            />
            <SidebarItem
              to="/fiscal"
              label={t('nav.fiscal')}
              icon={<NuevaunoIcon name="nuevauno_dte" />}
              collapsed={collapsed}
            />
            <SidebarItem
              to="/vault"
              label={t('nav.vault')}
              icon={<NuevaunoIcon name="nuevauno_vault" />}
              collapsed={collapsed}
            />
            <SidebarItem
              to="/kodo"
              label={t('nav.kodo')}
              icon={<NuevaunoIcon name="nuevauno_kodo" />}
              collapsed={collapsed}
            />
            {/* Gatekeeper management apps (e.g. the Context Library), listed dynamically. */}
            {!supportMode && gatekeeperApps.map((app) => {
              // Escape the icon URL for safe interpolation into a CSS url("…") string.
              const maskUrl = app.icon
                ? `url("${app.icon.url.replace(/[\\"]/g, '\\$&')}")`
                : undefined
              return (
              <SidebarItem
                key={app.id}
                to="/gatekeepers/$appId"
                params={{ appId: app.id }}
                label={app.title}
                icon={
                  maskUrl ? (
                    // Render the (monochrome) app icon as a CSS mask filled with the row's current
                    // text color, so it tints like the Phosphor icons — subtle by default, accent
                    // when active, darker on hover.
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 bg-current"
                      style={{
                        maskImage: maskUrl,
                        WebkitMaskImage: maskUrl,
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                      }}
                    />
                  ) : (
                    <NuevaunoIcon name="connections" size={14} />
                  )
                }
                collapsed={collapsed}
              />
              )
            })}
            {!supportMode && <SidebarItem
              to="/explore"
              label={t('nav.explore')}
              icon={<NuevaunoIcon name="knowledge" />}
              collapsed={collapsed}
            />}
          </nav>

          {/* Workspace tools: search. Pinned so it's always reachable. */}
          {!supportMode && <SidebarWorkspacesTools collapsed={collapsed} />}
        </div>

        {/* Scrolling middle: only the Favorites / Recent workspaces / Recent blueprints lists.
            min-h-0 lets flex children compute scroll height correctly. */}
        {!supportMode && <div className="sidebar-scroll mt-1 min-h-0 flex-1 overflow-y-auto">
          <SidebarWorkspacesLists collapsed={collapsed} />
        </div>}
      </SidebarWorkspacesProvider>

      <SidebarUtilityStrip collapsed={collapsed} />
    </aside>
  )
}
