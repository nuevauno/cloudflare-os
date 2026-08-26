const ICON_BASE = 'https://branding.nuevauno.com/icons/nuevauno'

export type NuevaunoIconName =
  | 'add' | 'attach_resource' | 'automation' | 'base' | 'close' | 'confirm'
  | 'connections' | 'delete' | 'documentos' | 'download' | 'edit' | 'favorite'
  | 'hoja_calculo' | 'knowledge' | 'more_options' | 'next' | 'notifications'
  | 'previous' | 'project' | 'search' | 'select_model' | 'send' | 'share'
  | 'sidebar' | 'theme_dark' | 'theme_light' | 'theme_system' | 'warning'
  | 'website_slides' | 'app' | 'back' | 'brain' | 'camera' | 'chart' | 'cloud'
  | 'code' | 'columns' | 'compass' | 'copy' | 'database' | 'expand'
  | 'external_link' | 'forward' | 'globe' | 'grid' | 'image' | 'info' | 'key'
  | 'link' | 'list' | 'lock' | 'refresh' | 'robot' | 'rows' | 'shield' | 'stack'
  | 'success' | 'swap' | 'terminal' | 'undo' | 'upload' | 'user' | 'user_add'
  | 'users' | 'view'
  | 'contacts' | 'crm' | 'nuevauno_billing' | 'nuevauno_certificates' | 'nuevauno_dte' | 'nuevauno_kodo' | 'nuevauno_vault' | 'point_of_sale'
  | 'sale' | 'stock'

export function resolveNuevaunoIconUrl(name: NuevaunoIconName, mode: 'light' | 'dark'): string {
  return `${ICON_BASE}/${name}${mode === 'dark' ? '-dark' : ''}.svg`
}

export default function NuevaunoIcon({
  name,
  size = 16,
  className = '',
  mode = 'auto',
}: {
  name: NuevaunoIconName
  size?: number
  className?: string
  mode?: 'auto' | 'light' | 'dark'
}) {
  if (mode !== 'auto') {
    return (
      <img
        src={resolveNuevaunoIconUrl(name, mode)}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`shrink-0 object-contain ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={resolveNuevaunoIconUrl(name, 'light')} alt="" width={size} height={size} className="block object-contain dark:hidden" />
      <img src={resolveNuevaunoIconUrl(name, 'dark')} alt="" width={size} height={size} className="hidden object-contain dark:block" />
    </span>
  )
}
