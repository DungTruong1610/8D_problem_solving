import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime } from '@/utils/formatters/date';

/**
 * React hook that wraps date formatting utilities with the current i18n locale.
 * Respects `i18n.language` so dates re-format automatically when locale changes.
 *
 * Usage:
 *   const { formatDate, formatDateTime } = useDateFormatter();
 *   formatDate('2026-01-14T09:13:15Z')  → "14 Jan 2026" (en)
 *   formatDateTime('2026-01-14T09:13:15Z')  → "14 Jan 2026, 09:13" (en)
 */
export function useDateFormatter() {
    const { i18n } = useTranslation();

    return {
        formatDate: (value?: string | Date | null, options?: Intl.DateTimeFormatOptions) => {
            const str = value instanceof Date ? value.toISOString() : value ?? undefined;
            return formatDate(str, i18n.language, options);
        },
        formatDateTime: (value?: string | Date | null, options?: Intl.DateTimeFormatOptions) => {
            const str = value instanceof Date ? value.toISOString() : value ?? undefined;
            return formatDateTime(str, i18n.language, options);
        },
    };
}
