/**
 * pgvector Bridge for Proresolve 8D Historical Cases
 * Replaces SAP HANA Graph Workspace with native PostgreSQL pgvector similarity search.
 */
import cds from '@sap/cds';

const LOG = cds.log('pgvector-bridge');

export interface VectorSearchResult {
    notificationId: string;
    symptomShortText: string | null;
    defectText: string | null;
    workCenterDesc: string | null;
    similarity: number;
}

/**
 * Checks if the active database is PostgreSQL with pgvector extension available.
 */
export async function isPgvectorAvailable(): Promise<boolean> {
    const kind = String((cds.env.requires as any)?.db?.kind ?? '');
    if (!kind.includes('postgres')) return false;

    try {
        const db = await cds.connect.to('db');
        const rows = await db.run("SELECT extname FROM pg_extension WHERE extname = 'vector'");
        return Array.isArray(rows) && rows.length > 0;
    } catch (e: any) {
        LOG.warn(`[pgvector] Error checking pgvector availability: ${e.message}`);
        return false;
    }
}

/**
 * Updates the native vector(1536) column for a historical case.
 */
export async function updateCaseVector(notificationId: string, embedding: number[]): Promise<boolean> {
    if (!embedding || !embedding.length) return false;

    try {
        const db = await cds.connect.to('db');
        const vectorStr = `[${embedding.join(',')}]`;
        await db.run(
            `UPDATE cnma_proresolve_historicalcases 
             SET embedding_vector = $1::vector, 
                 embedding = $2 
             WHERE notificationid = $3`,
            [vectorStr, JSON.stringify(embedding), notificationId]
        );
        return true;
    } catch (e: any) {
        LOG.warn(`[pgvector] Error updating vector for ${notificationId}: ${e.message}`);
        return false;
    }
}

/**
 * Searches for most similar historical cases using pgvector cosine distance (<=>).
 * Returns cases sorted by cosine similarity descending (1 - distance).
 */
export async function searchSimilarCasesByVector(
    queryVector: number[],
    limit: number = 5
): Promise<VectorSearchResult[]> {
    if (!queryVector || !queryVector.length) return [];

    try {
        const db = await cds.connect.to('db');
        const vectorStr = `[${queryVector.join(',')}]`;
        const query = `
            SELECT notificationid AS "notificationId", 
                   symptomshorttext AS "symptomShortText", 
                   defecttext AS "defectText", 
                   workcenterdesc AS "workCenterDesc",
                   1 - (embedding_vector <=> $1::vector) AS similarity
            FROM cnma_proresolve_historicalcases
            WHERE embedding_vector IS NOT NULL
            ORDER BY embedding_vector <=> $1::vector ASC
            LIMIT $2
        `;
        const rows = await db.run(query, [vectorStr, limit]);
        return (rows as any[]).map((r) => ({
            notificationId: String(r.notificationId ?? r.notificationid),
            symptomShortText: r.symptomShortText ?? r.symptomshorttext ? String(r.symptomShortText ?? r.symptomshorttext) : null,
            defectText: r.defectText ?? r.defecttext ? String(r.defectText ?? r.defecttext) : null,
            workCenterDesc: r.workCenterDesc ?? r.workcenterdesc ? String(r.workCenterDesc ?? r.workcenterdesc) : null,
            similarity: Number(r.similarity),
        }));
    } catch (e: any) {
        LOG.error(`[pgvector] Similarity search query failed: ${e.message}`);
        return [];
    }
}
