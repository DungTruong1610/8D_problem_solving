/**
 * Locale-aware date formatting utilities.
 * Always return '-' for empty/invalid values.
 */

/** Format an ISO date string to a short/medium date (no time). */
export function formatDate(
    value?: string | null,
    locale: string = 'en',
    options?: Intl.DateTimeFormatOptions
): string {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';

    const defaults: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };
    return new Intl.DateTimeFormat(locale, options ?? defaults).format(date);
}

/**
 * Format a UTC ISO date/time string to local timezone with both date and time.
 * Uses browser locale for proper regional formatting (e.g. DD.MM.YYYY for de-DE).
 */
export function formatDateTime(
    value?: string | null,
    locale: string = 'en',
    options?: Intl.DateTimeFormatOptions
): string {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';

    const defaults: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
    const resolvedLocale = locale || navigator.language || 'en';
    return new Intl.DateTimeFormat(resolvedLocale, options ?? defaults).format(date);
}

/** Format a number of milliseconds as "X days", "X hours", "X mins". */
export function formatDuration(ms: number): string {
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
    return `${Math.round(ms / 86_400_000)}d`;
}
