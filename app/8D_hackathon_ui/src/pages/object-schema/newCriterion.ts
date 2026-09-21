import type { ProfileCriterion, SourceFieldInfo } from '@/services/retrieval-service';

/**
 * A catalog field dropped into a profile becomes a criterion.
 *
 * Shared by the standalone page and the per-step editor so a field dragged in
 * behaves identically on both — two copies of these defaults would drift, and
 * the drift would only show up as different scores.
 */

/** Field path → a stable criterion key, unique within the profile. */
export function criterionKeyFor(path: string, taken: Set<string>): string {
    const base = path
        .replace(/\[\]/g, '')
        .split('.')
        .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 36) || 'criterion';
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    return `${base}${n}`;
}

/**
 * Starts DISABLED with weight 1, on purpose: enabling it immediately would move
 * the reachable score before anyone has weighed the field, and every case would
 * rescore for a change nobody meant to make.
 */
export function newCriterionFrom(
    field: SourceFieldInfo,
    profileKey: string,
    taken: Set<string>,
): ProfileCriterion {
    const method = field.methods[0] ?? 'exact';
    return {
        profile_profileKey: profileKey,
        criterionKey: criterionKeyFor(field.path, taken),
        label: field.label,
        description: field.note,
        sourceTable: field.sourceTable,
        sourceField: field.path,
        matchType: method,
        weight: 1,
        fallbackField: null,
        fallbackMatch: null,
        fallbackWeight: null,
        minSimilarity: method === 'cosine' ? 0.7 : null,
        enabled: false,
        sortOrder: 0,
    };
}
