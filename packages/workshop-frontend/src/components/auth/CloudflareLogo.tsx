import NuevaunoIcon from '../NuevaunoIcon'

interface CloudflareLogoProps {
  size?: number
  className?: string
}

export default function CloudflareLogo({ size = 18, className }: CloudflareLogoProps) {
  return <NuevaunoIcon name="cloud" size={size} className={className} />
}
