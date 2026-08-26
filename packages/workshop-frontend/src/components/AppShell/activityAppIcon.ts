import type { ActivityEventView } from '@gadgets/workshop-shared/api'
import type { NuevaunoIconName } from '../NuevaunoIcon'

const APP_ICON_BY_NAMESPACE: Readonly<Record<string, NuevaunoIconName>> = {
  billing: 'nuevauno_billing',
  catalog: 'stock',
  collection: 'nuevauno_billing',
  contact: 'contacts',
  crm: 'crm',
  kodo: 'nuevauno_kodo',
  pos: 'point_of_sale',
  sale: 'sale',
}

/** Resolves an activity event to the canonical icon of the app that produced it. */
export function activityAppIcon(event: Pick<ActivityEventView, 'activityKey' | 'eventType'>): NuevaunoIconName {
  const technicalName = event.activityKey ?? event.eventType
  const namespace = technicalName.split('.', 1)[0]?.toLowerCase()
  return APP_ICON_BY_NAMESPACE[namespace] ?? 'app'
}
