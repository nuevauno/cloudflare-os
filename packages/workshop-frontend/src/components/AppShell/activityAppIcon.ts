import type { ActivityEventView } from '@gadgets/workshop-shared/api'
import type { NuevaunoIconName } from '../NuevaunoIcon'

const APP_ICON_BY_NAMESPACE: Readonly<Record<string, NuevaunoIconName>> = {
  billing: 'nuevauno_billing',
  catalog: 'stock',
  collection: 'nuevauno_billing',
  certificate: 'nuevauno_certificates',
  contact: 'contacts',
  dispatch: 'nuevauno_dte',
  fiscal: 'nuevauno_dte',
  crm: 'crm',
  kodo: 'nuevauno_kodo',
  pos: 'point_of_sale',
  sale: 'sale',
  vault: 'nuevauno_vault',
}

/** Resolves an activity event to the canonical icon of the app that produced it. */
export function activityAppIcon(event: Pick<ActivityEventView, 'activityKey' | 'eventType'>): NuevaunoIconName {
  const technicalName = event.activityKey ?? event.eventType
  const namespace = technicalName.split('.', 1)[0]?.toLowerCase()
  return APP_ICON_BY_NAMESPACE[namespace] ?? 'app'
}
