import { Text, Loader } from '@cloudflare/kumo'
import { VendorDescription } from '@gadgets/workshop-shared/gatekeeper'
import { GatekeeperIcon } from './components/GatekeeperIcon'

export interface VendorCardProps {
  vendor: VendorDescription
  vendorId: string
  onClick: () => void
  /** Whether this vendor is currently being connected */
  loading?: boolean
  /** Whether this card is disabled (e.g., another vendor is being connected) */
  disabled?: boolean
}

export default function VendorCard({
  vendor,
  vendorId,
  onClick,
  loading = false,
  disabled = false,
}: VendorCardProps) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`flex items-center gap-4 p-4 border border-kumo-line rounded-lg transition-all ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-kumo-brand hover:bg-kumo-tint'
      } ${disabled && !loading ? 'opacity-50' : ''}`}
    >
      <GatekeeperIcon vendorId={vendorId} fallbackText={vendor.displayName} size={22} className="h-12 w-12 rounded-lg" />
      <div className="flex-1">
        <Text variant="body" bold as="span" DANGEROUS_className="block text-base">
          {vendor.displayName}
        </Text>
        {vendor.url && (
          <Text variant="secondary" size="xs" as="span">
            {vendor.url}
          </Text>
        )}
      </div>
      {loading && <Loader size="sm" />}
    </div>
  )
}
