export type UserLanguage = 'es' | 'en'
export type UserHourCycle = 'h12' | 'h24'

export const DEFAULT_LANGUAGE: UserLanguage = 'es'
export const DEFAULT_TIME_ZONE = 'America/Santiago'
export const DEFAULT_HOUR_CYCLE: UserHourCycle = 'h24'

export function getUserLanguage(): UserLanguage {
  return localStorage.getItem('nuevauno.language') === 'en' ? 'en' : DEFAULT_LANGUAGE
}

export function getUserTimeZone(): string {
  return localStorage.getItem('nuevauno.timeZone') || DEFAULT_TIME_ZONE
}

export function getUserHourCycle(): UserHourCycle {
  return localStorage.getItem('nuevauno.hourCycle') === 'h12' ? 'h12' : DEFAULT_HOUR_CYCLE
}

export function applyUserPreferences(language: UserLanguage, timeZone: string, hourCycle: UserHourCycle): void {
  localStorage.setItem('nuevauno.language', language)
  localStorage.setItem('nuevauno.timeZone', timeZone)
  localStorage.setItem('nuevauno.hourCycle', hourCycle)
  document.documentElement.lang = language
  window.dispatchEvent(new CustomEvent('nuevauno:preferences'))
}
