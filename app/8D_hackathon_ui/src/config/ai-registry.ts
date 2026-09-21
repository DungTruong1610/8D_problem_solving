import {
    registerActivities,
    registerEmbeddingCorpora,
    type EmbeddingCorpus,
} from '@cnma/sap-aicore-integrate/react/shared';
import { EIGHTD_ACTIVITIES } from '../../../../shared/ai-activities';

/**
 * Đăng ký registry AI cho bundle UI.
 * Reads single source of truth from shared/ai-activities.
 */
const ACTIVITIES = EIGHTD_ACTIVITIES;

const EMBEDDING_CORPORA: readonly EmbeddingCorpus[] = Object.freeze([
    Object.freeze({
        kind: 'default',
        label: 'Default corpus',
        description:
            'Placeholder corpus so the integration layer runs before any vector table exists. Replace kind and schemaColumns once the real schema lands.',
        dim: 1536,
        schemaColumns: '<Entity>.embedding cds.Vector(1536)',
        defaultModel: 'text-embedding-3-small',
        modelEnvVar: 'AICORE_MODEL_EMBEDDING',
    }),
]);

let registered = false;

/** Idempotent — gọi một lần ở main.tsx, trước khi render. */
export function registerAiRegistry(): void {
    if (registered) return;
    registerActivities([...ACTIVITIES]);
    registerEmbeddingCorpora([...EMBEDDING_CORPORA]);
    registered = true;
}
