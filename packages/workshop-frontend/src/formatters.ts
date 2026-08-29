import type { UserHourCycle, UserLanguage } from './userPreferences'

export type FormatPreferences = { language: UserLanguage; timeZone: string; hourCycle: UserHourCycle }

export function formatDateTime(value: Date | number, preferences: FormatPreferences): string {
  return new Intl.DateTimeFormat(preferences.language, {
    dateStyle: 'short', timeStyle: 'short', timeZone: preferences.timeZone,
    hour12: preferences.hourCycle === 'h12',
  }).format(value)
}

export function formatNumber(value: number, language: UserLanguage): string {
  return new Intl.NumberFormat(language).format(value)
}
