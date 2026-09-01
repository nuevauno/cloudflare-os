export const SIDEBAR_UTILITY_CLASS = 'mt-auto shrink-0 flex items-center gap-1 border-t border-kumo-line bg-kumo-elevated px-3 py-2'

export function statusPlanLabel(planLabel: string, planName: string, language: 'es' | 'en'): string {
  return `${planLabel} ${planName}`.toLocaleUpperCase(language === 'es' ? 'es-CL' : 'en-US')
}

export function companyDisplayLabel(name: string, language: 'es' | 'en' = 'es'): string {
  return name.toLocaleUpperCase(language === 'es' ? 'es-CL' : 'en-US')
}

export function enabledAppsForSession(session: {
  activeOrganizationId?: string
  activeCompanyId?: string
  organizations: Array<{ id: string; enabledApps?: string[]; companies?: Array<{ id: string }> }>
} | null): Set<string> {
  const companyOrganization = session?.activeCompanyId
    ? session.organizations.find((item) => item.companies?.some((company) => company.id === session.activeCompanyId))
    : undefined
  const organization = companyOrganization
    ?? session?.organizations.find((item) => item.id === session.activeOrganizationId)
    ?? session?.organizations[0]
  return new Set(organization?.enabledApps ?? [])
}
