import { useEffect, useState } from 'react'

const BRAND_SPEC_URL = 'https://branding.nuevauno.com/brand-spec.json'

export type NuevaunoBrandSpec = {
  canonical: {
    cursor: {
      color: string
      width: number
      height: number
      marginLeft: number
      cornerRadius: number
      verticalAlign: string
      blink: { duration: string; timing: string }
    }
    lockup: {
      wordFontSizeRel: number
      markWordGap: number
      wordFont: string
      wordLetterSpacing: string
    }
  }
}

let cachedSpec: NuevaunoBrandSpec | null = null
let pendingSpec: Promise<NuevaunoBrandSpec> | null = null

function loadBrandSpec(): Promise<NuevaunoBrandSpec> {
  if (cachedSpec) return Promise.resolve(cachedSpec)
  pendingSpec ??= fetch(BRAND_SPEC_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Brand spec unavailable: ${response.status}`)
      return response.json() as Promise<NuevaunoBrandSpec>
    })
    .then((spec) => {
      cachedSpec = spec
      return spec
    })
    .finally(() => {
      pendingSpec = null
    })
  return pendingSpec
}

/** Loads the public machine-readable brand source instead of duplicating its geometry. */
export function useNuevaunoBrandSpec(enabled = true): NuevaunoBrandSpec | null {
  const [spec, setSpec] = useState<NuevaunoBrandSpec | null>(cachedSpec)

  useEffect(() => {
    if (!enabled || spec) return
    let active = true
    void loadBrandSpec().then((loaded) => {
      if (active) setSpec(loaded)
    }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [enabled, spec])

  return spec
}
