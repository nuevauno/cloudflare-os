import { useAuthenticatedApi } from '../../AuthContext'
import NuevaunoIcon from '../NuevaunoIcon'

export default function BusinessContextSwitcher({ collapsed }: { collapsed: boolean }) {
  const { businessSession, selectBusinessContext } = useAuthenticatedApi()
  const companies = businessSession?.organizations.flatMap((organization) =>
    organization.companies.map((company) => ({ organization, company }))) ?? []
  if (companies.length === 0) return null

  const value = businessSession?.activeCompanyId ?? ''
  if (collapsed) {
    const active = companies.find(({ company }) => company.id === value)
    return (
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-kumo-line bg-kumo-base text-kumo-default" title={active?.company.displayName ?? 'Empresa'}>
        <NuevaunoIcon name="app" size={15} />
      </div>
    )
  }
  return (
    <div className="px-2">
      <label className="block text-[10px] uppercase tracking-[0.12em] text-kumo-subtle" htmlFor="business-company">Empresa</label>
      <select
        id="business-company"
        value={value}
        onChange={(event) => {
          const selected = companies.find(({ company }) => company.id === event.target.value)
          if (selected) void selectBusinessContext(selected.organization.id, selected.company.id)
        }}
        className="mt-1 h-9 w-full border border-kumo-line bg-kumo-base px-2 text-[13px] text-kumo-default outline-none focus:border-kumo-accent"
      >
        <option value="" disabled>Selecciona una empresa</option>
        {companies.map(({ company }) => (
          <option key={company.id} value={company.id}>{company.displayName}</option>
        ))}
      </select>
    </div>
  )
}
