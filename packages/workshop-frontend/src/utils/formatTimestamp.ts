// Locale-aware timestamp formatting for chat UI tooltips.
//
import { getUserLanguage, getUserTimeZone } from '../userPreferences'
//
// The formatter instance is cached at module scope because constructing `Intl.DateTimeFormat` is
// surprisingly expensive and a chat view can render hundreds of timestamps.

let fullTimestampFormatter: Intl.DateTimeFormat | null = null;

function getFullTimestampFormatter(): Intl.DateTimeFormat {
  if (fullTimestampFormatter === null) {
    fullTimestampFormatter = new Intl.DateTimeFormat(getUserLanguage(), {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: getUserTimeZone(),
    });
  }
  return fullTimestampFormatter;
}

/**
 * Format a date as a locale-aware short date + time, e.g. "5/11/26, 5:09 PM" (en-US) or
 * "11/05/2026, 17:09" (en-GB). Intended for chat timestamp tooltips that need to disambiguate
 * which day a message belongs to.
 */
export function formatFullTimestamp(date: Date): string {
  return getFullTimestampFormatter().format(date);
}
