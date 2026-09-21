/**
 * Locale-aware number formatting and DB normalization utilities.
 *
 * Display: numbers formatted per user's locale (e.g. "1.234,56" in de-DE).
 * DB:      numbers stored without thousand separators, '.' as decimal ("1234.56").
 */

/** Returns the decimal and thousand separator characters for a given locale. */
export function getLocaleNumberSeparators(locale: string): { decimal: string; thousand: string } {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.89);
    let decimal = '.';
    let thousand = '';
    for (const part of parts) {
        if (part.type === 'decimal') decimal = part.value;
        if (part.type === 'group') thousand = part.value;
    }
    return { decimal, thousand };
}

/**
 * Parse a locale-formatted number string into a JS number.
 * "1.234,56" (de) → 1234.56   |   "1,234.56" (en) → 1234.56
 */
export function parseLocaleNumber(value: string, locale: string): number | null {
    if (value == null || String(value).trim() === '') return null;
    const str = String(value).trim();
    const { decimal, thousand } = getLocaleNumberSeparators(locale);

    let normalized = str;
    if (thousand) normalized = normalized.split(thousand).join('');
    normalized = normalized.replace(/[\s\u00A0]/g, '');
    if (decimal !== '.') normalized = normalized.replace(decimal, '.');

    const num = Number(normalized);
    return isNaN(num) ? null : num;
}

/**
 * Format a number (or DB-format string) for locale display.
 * 1234.56 → "1.234,56" (de, scale=2)  |  1234.56 → "1,234.56" (en, scale=2)
 */
export function formatLocaleNumber(
    value: number | string | null | undefined,
    locale: string,
    scale?: number
): string {
    if (value == null || String(value).trim() === '') return '';

    const num = typeof value === 'number' ? value : parseLocaleNumber(String(value), locale);
    if (num === null || isNaN(num)) return String(value);

    const opts: Intl.NumberFormatOptions = {};
    if (scale !== undefined && scale >= 0) {
        opts.minimumFractionDigits = scale;
        opts.maximumFractionDigits = scale;
    } else {
        opts.maximumFractionDigits = 20;
    }
    return new Intl.NumberFormat(locale, opts).format(num);
}

/**
 * Normalize a locale-formatted number string to DB format.
 * "1.234,56" (de) → "1234.56"  |  "123" (en, scale=2) → "123.00"
 */
export function normalizeNumberForDB(value: string, locale: string, scale?: number): string {
    if (value == null || String(value).trim() === '') return '';
    const num = parseLocaleNumber(String(value).trim(), locale);
    if (num === null) return String(value);
    if (scale !== undefined && scale >= 0) return num.toFixed(scale);
    return num.toString();
}
