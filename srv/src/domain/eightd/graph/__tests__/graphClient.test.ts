import { buildCypherTable } from '../graphClient';
import { NODE, EDGE, WORKSPACE } from '../model';

describe('buildCypherTable', () => {
    it('không khai PARAMETERS khi truy vấn không có tham số', () => {
        const { sql, values } = buildCypherTable('MATCH (c:Case8D) RETURN c.BIZ_KEY AS A');
        expect(sql).toBe(
            `OPENCYPHER_TABLE( GRAPH WORKSPACE "${WORKSPACE}" QUERY 'MATCH (c:Case8D) RETURN c.BIZ_KEY AS A' )`,
        );
        expect(values).toEqual([]);
    });

    it('khai một ô ? cho mỗi tham số, đúng thứ tự đã khai', () => {
        const { sql, values } = buildCypherTable(
            'MATCH (c:Case8D) WHERE c.BIZ_KEY = $nid AND c.COPQ_EUR > $floor RETURN c.BIZ_KEY AS A',
            { nid: '8D-10048412', floor: 1000 },
        );
        expect(sql).toContain(`PARAMETERS ('nid' = ?, 'floor' = ?)`);
        expect(values).toEqual(['8D-10048412', 1000]);
    });

    /**
     * Đây là lưới an toàn thật sự của lớp này. Giá trị của người dùng không bao
     * giờ được ghép vào chuỗi truy vấn; nếu một ngày ai đó ghép, test này không
     * bắt được — nên nó kiểm điều kiểm được: giá trị đi qua đường tham số thì
     * KHÔNG xuất hiện trong SQL.
     */
    it('giá trị đi vào ô bind, không vào chuỗi truy vấn', () => {
        const hostile = `MAT-10247' OR '1'='1`;
        const { sql, values } = buildCypherTable(
            'MATCH (m:Material) WHERE m.BIZ_KEY = $mat RETURN m.BIZ_KEY AS A',
            { mat: hostile },
        );
        expect(sql).not.toContain(hostile);
        expect(sql).not.toContain('1=1');
        expect(values).toEqual([hostile]);
    });

    it('nhân đôi nháy đơn của chính câu Cypher để nhúng được vào SQL', () => {
        const { sql } = buildCypherTable(
            `MATCH (c:Case8D)-[e:RESOLVED_BY]->(a:Action) WHERE e.ACTION_TYPE = 'Corrective' RETURN a.BIZ_KEY AS A`,
        );
        expect(sql).toContain(`e.ACTION_TYPE = ''Corrective''`);
    });

    it('từ chối tên tham số không phải định danh', () => {
        expect(() => buildCypherTable('MATCH (c:Case8D) RETURN c.BIZ_KEY AS A', { "a' = ?) --": 'x' }))
            .toThrow(/Tên tham số Cypher không hợp lệ/);
    });
});

describe('từ vựng graph', () => {
    /**
     * `CASE` là từ khoá openCypher; `MATCH (c:Case)` không parse được và thông
     * báo lỗi của HANA không hề nhắc tới từ khoá. Đã mất một vòng deploy để tìm
     * ra, nên nó bị khoá lại ở đây.
     */
    it('không nhãn nào trùng từ khoá dành riêng của openCypher', () => {
        const reserved = new Set([
            'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'MATCH', 'WHERE', 'RETURN', 'WITH',
            'AS', 'AND', 'OR', 'NOT', 'NULL', 'TRUE', 'FALSE', 'DISTINCT', 'ORDER',
            'BY', 'SKIP', 'LIMIT', 'UNION', 'OPTIONAL', 'CREATE', 'DELETE', 'SET',
            'MERGE', 'ON', 'DETACH', 'EXISTS', 'ALL', 'ANY', 'NONE', 'SINGLE', 'IN',
            'STARTS', 'ENDS', 'CONTAINS', 'IS', 'FUNCTION',
        ]);
        for (const label of [...Object.values(NODE), ...Object.values(EDGE)]) {
            expect(reserved.has(label.toUpperCase())).toBe(false);
        }
    });

    it('nhãn đỉnh và loại cạnh đều là duy nhất', () => {
        const labels = [...Object.values(NODE), ...Object.values(EDGE)];
        expect(new Set(labels).size).toBe(labels.length);
    });
});
