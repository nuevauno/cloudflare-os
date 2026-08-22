export type UserLanguage = 'es' | 'en'

export const DEFAULT_LANGUAGE: UserLanguage = 'es'
export const DEFAULT_TIME_ZONE = 'America/Santiago'

export function getUserLanguage(): UserLanguage {
  return localStorage.getItem('nuevauno.language') === 'en' ? 'en' : DEFAULT_LANGUAGE
}

export function getUserTimeZone(): string {
  return localStorage.getItem('nuevauno.timeZone') || DEFAULT_TIME_ZONE
}

export function setUserPreferences(language: UserLanguage, timeZone: string): void {
  localStorage.setItem('nuevauno.language', language)
  localStorage.setItem('nuevauno.timeZone', timeZone)
  document.documentElement.lang = language
  window.dispatchEvent(new CustomEvent('nuevauno:preferences'))
}
