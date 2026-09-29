/**
 * Chạy openCypher trên HANA và ghép kết quả với SQL.
 *
 * ── Vì sao Cypher không tự làm hết ──
 * Phương ngữ openCypher của HANA hẹp hơn Cypher chuẩn đáng kể. Đo trực tiếp trên
 * chính instance đang dùng (2026-09-03):
 *
 *   CHẠY ĐƯỢC   nhãn `(c:Case8D)` · cạnh CÓ TÊN `-[e:TYPE]->` · mẫu ngăn bằng
 *               dấu phẩy · đường độ dài biến thiên `p = (a)-[*1..3]-(b)` ·
 *               WHERE/AND/OR/IN/<> · RETURN DISTINCT · ORDER BY · LIMIT ·
 *               PARAMETERS ('x' = ?)
 *   KHÔNG CHẠY  MỌI hàm tổng hợp (count, collect) · WITH · OPTIONAL MATCH ·
 *               mũi tên ngược `<-[e]-` · chuỗi `(a)-[e1]->(b)-[e2]->(c)` ·
 *               nhiều mệnh đề MATCH · SKIP · IS NOT NULL · NOT (mẫu)
 *
 * Nên phân vai là: **Cypher khớp mẫu, SQL tổng hợp và xếp hạng.** Không phải
 * thoả hiệp tạm — đó là hình dạng đúng cho công cụ này, và nó cũng là cách SAP
 * thiết kế `OPENCYPHER_TABLE`: hàm trả về một bảng để SQL dùng tiếp.
 *
 * ── Vì sao không có API nhận Cypher tự do ──
 * Mọi câu Cypher trong repo là hằng số do lập trình viên viết, nằm trong
 * `queries/`, có test. Giá trị của người dùng KHÔNG BAO GIỜ đi vào chuỗi câu
 * truy vấn — chúng đi qua `PARAMETERS`. Đã kiểm: truyền `MAT-10247' OR '1'='1`
 * qua tham số trả về 0 dòng, tức là nó ở lại làm dữ liệu.
 */

import cds from '@sap/cds';
import { TABLE, WORKSPACE } from './model';

const LOG = cds.log('graph');

/** Giá trị được phép truyền vào Cypher. Object/mảng không có nghĩa ở đây. */
export type CypherParam = string | number;

export interface GraphQuery<Row> {
    /**
     * Câu Cypher, viết như bình thường với nháy đơn.
     *
     * Nháy đơn được nhân đôi khi nhúng vào SQL — người viết query không phải
     * nghĩ tới chuyện đó, và không được phép nghĩ tới: escape thủ công rải rác
     * là cách chắc chắn nhất để một chỗ quên.
     */
    cypher: string;

    /** Tham số Cypher. Khoá phải khớp `$tên` trong câu. */
    params?: Record<string, CypherParam>;

    /**
     * Bọc kết quả Cypher bằng SQL — đây là chỗ đếm, gom nhóm, xếp hạng và join
     * ngược về bảng thật. `graph` là mảnh `OPENCYPHER_TABLE(...) alias` đã dựng sẵn.
     *
     * Bỏ trống ⇒ `SELECT * FROM <graph>`.
     */
    wrap?: (graph: string) => string;

    /**
     * Tham số của phần SQL bọc ngoài, nối SAU tham số Cypher.
     *
     * Thứ tự này không tuỳ tiện: `OPENCYPHER_TABLE(...)` nằm trong mệnh đề FROM,
     * nên các `?` của nó xuất hiện trước mọi `?` trong WHERE/HAVING của câu bọc.
     * Đảo thứ tự thì giá trị vào nhầm ô mà không có lỗi nào — chỉ ra kết quả sai.
     */
    wrapParams?: readonly CypherParam[];
}

/** Nhân đôi nháy đơn để nhúng được vào literal chuỗi của SQL. */
function sqlLiteral(text: string): string {
    return text.replace(/'/g, "''");
}

/**
 * Tên tham số Cypher phải là định danh thuần.
 *
 * Tên do lập trình viên đặt chứ không đến từ người dùng, nên đây là lưới an toàn
 * chứ không phải hàng rào: nó bắt lỗi gõ nhầm ngay tại chỗ thay vì để HANA báo
 * một lỗi cú pháp trỏ vào giữa chuỗi đã ghép.
 */
const PARAM_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Dựng mảnh `OPENCYPHER_TABLE(...)` cùng danh sách giá trị theo đúng thứ tự. */
export function buildCypherTable(
    cypher: string,
    params: Record<string, CypherParam> = {},
): { sql: string; values: CypherParam[] } {
    const names = Object.keys(params);
    for (const name of names) {
        if (!PARAM_NAME.test(name)) {
            throw new Error(`Tên tham số Cypher không hợp lệ: ${JSON.stringify(name)}`);
        }
    }

    const declaration = names.length
        ? ` PARAMETERS (${names.map((n) => `'${n}' = ?`).join(', ')})`
        : '';

    return {
        sql: `OPENCYPHER_TABLE( GRAPH WORKSPACE "${WORKSPACE}" QUERY '${sqlLiteral(cypher)}'${declaration} )`,
        values: names.map((n) => params[n]),
    };
}

/** Chạy một truy vấn graph. Trả về đúng những dòng SQL bọc ngoài sinh ra. */
export async function runGraphQuery<Row = Record<string, unknown>>(
    query: GraphQuery<Row>,
): Promise<Row[]> {
    const backend = await getGraphBackend();
    if (backend !== 'hana') {
        throw new Error(`openCypher cần HANA Graph workspace; backend hiện tại là ${backend ?? 'unavailable'}.`);
    }
    const db = await cds.connect.to('db');
    const { sql: graph, values } = buildCypherTable(query.cypher, query.params);
    const sql = query.wrap ? query.wrap(`${graph} g`) : `SELECT * FROM ${graph} g`;
    const all = [...values, ...(query.wrapParams ?? [])];

    const started = Date.now();
    const rows = (await db.run(sql, all)) as Row[];
    LOG.debug(`graph query ${rows.length} dòng trong ${Date.now() - started}ms`);
    return rows;
}

/** Backend selection is stable for the process, so cache the readiness check. */
export type GraphBackend = 'hana' | 'sqlite' | null;

let availability: Promise<GraphBackend> | null = null;

export function resetGraphAvailability(): void {
    availability = null;
}

/** Chọn backend retrieval; SQLite dựng quan hệ từ kho case đã chuẩn hoá. */
export async function getGraphBackend(): Promise<GraphBackend> {
    availability ??= (async () => {
        const kind = String((cds.env.requires as any)?.db?.kind ?? '');

        if (kind.startsWith('sqlite')) {
            try {
                const db = await cds.connect.to('db');
                // Bảng HistoricalCases đã lưu sẵn các cạnh phẳng (mã lỗi, vật tư,
                // work center, họ vật tư, từ khoá); không cần graph workspace riêng.
                await db.run(`SELECT "NOTIFICATIONID" FROM "${TABLE.historicalCases}" LIMIT 0`);
                LOG.info('SQLite graph backend sẵn sàng; dựng cạnh từ HistoricalCases/HistoricalActions.');
                return 'sqlite';
            } catch (e: any) {
                LOG.warn(`Không đọc được kho precedent trên SQLite (${e.message}) — dùng engine chấm điểm.`);
                return null;
            }
        }

        if (!kind.startsWith('hana')) {
            LOG.info(`db.kind = ${kind || '(không rõ)'} — không có graph backend, dùng engine chấm điểm.`);
            return null;
        }
        try {
            const db = await cds.connect.to('db');
            const rows = (await db.run(
                'SELECT "IS_VALID" FROM SYS.GRAPH_WORKSPACES '
                + 'WHERE SCHEMA_NAME = CURRENT_SCHEMA AND WORKSPACE_NAME = ?',
                [WORKSPACE],
            )) as Array<{ IS_VALID?: string }>;

            const valid = rows.length > 0 && String(rows[0].IS_VALID).toUpperCase() === 'TRUE';
            if (!valid) {
                LOG.warn(
                    `Graph workspace ${WORKSPACE} ${rows.length ? 'tồn tại nhưng KHÔNG hợp lệ' : 'chưa được deploy'}`
                    + ' — dùng engine chấm điểm. Chạy `npm run deploy:graph`.',
                );
            }
            return valid ? 'hana' : null;
        } catch (e: any) {
            LOG.warn(`Không kiểm được graph workspace (${e.message}) — dùng engine chấm điểm.`);
            return null;
        }
    })();
    return availability;
}

export async function isGraphAvailable(): Promise<boolean> {
    return (await getGraphBackend()) !== null;
}
