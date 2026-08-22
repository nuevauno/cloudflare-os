import { RELEASE_VERSION } from '../release'

export default function ReleaseVersion() {
  return (
    <span
      data-release-version={RELEASE_VERSION}
      aria-label={`Versión ${RELEASE_VERSION}`}
      className="select-none text-[10px] font-normal tracking-wide text-kumo-inactive"
    >
      {RELEASE_VERSION}
    </span>
  )
}
