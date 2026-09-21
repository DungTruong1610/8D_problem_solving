// App-wide constants
// Add application-specific constants here

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_FILE_SIZE_MB = 10;
export const DATE_FORMAT_DEFAULT = 'medium'; // Intl.DateTimeFormatOptions dateStyle

/** OData top/skip defaults */
export const ODATA_DEFAULT_TOP = 100;

/** Supported locale codes */
export const SUPPORTED_LOCALES = ['en', 'de'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
