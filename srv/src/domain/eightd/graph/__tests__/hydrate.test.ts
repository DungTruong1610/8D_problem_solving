/**
 * `hydratePrecedents` phải đọc được dòng trả về từ SQLite.
 *
 * SQLite đặt tên khoá của dòng theo tên KHAI BÁO của cột (`notificationId`), trừ
 * khi câu SELECT có alias. HANA thì trả chữ hoa, nên câu SQL không alias chạy
 * đúng trên HANA và trả về 0 tiền lệ trên SQLite — không lỗi, không log, vì
 * `flatMap` bỏ mọi dòng không tìm thấy khoá.
 *
 * DB giả dưới đây làm đúng như SQLite: cột nào có `AS "X"` thì trả khoá `X`, cột
 * nào không có thì trả tên khai báo dạng camelCase.
 */

const DECLARED: Record<string, string> = {
    NOTIFICATIONID: 'notificationId', SYMPTOMSHORTTEXT: 'symptomShortText', SAPSTATUS: 'sapStatus',
    QUANTITYEXTENT: 'quantityExtent', WORKCENTERID: 'workCenterId', WORKCENTERDESC: 'workCenterDesc',
    DEFECTCODE: 'defectCode', DEFECTTEXT: 'defectText', MATERIALID: 'materialId',
    MATERIALDESC: 'materialDesc', ROOTCAUSECATEGORY: 'rootCauseCategory', COPQEUR: 'copqEur',
    FMEAID: 'fmeaId', PARTNERID: 'partnerId', PARTNERNAME: 'partnerName',
    FUNCTIONTITLE: 'functionTitle', PARTNERROLE: 'partnerRole', EMAIL: 'email', PHONE: 'phone',
    LINENO: 'lineNo', ACTIONTYPE: 'actionType', ACTIONTEXT: 'actionText', STATUS: 'status',
    TASKCODE: 'taskCode', TASKCODEGROUP: 'taskCodeGroup', TASKPROCESSOR: 'taskProcessor',
    TIMEEFFORT: 'timeEffort',
};

const CASE = {
    NOTIFICATIONID: '8D-10049160', SYMPTOMSHORTTEXT: 'Induction case depth below minimum',
    SAPSTATUS: 'Closed', COMPLETIONDATE: '2026-08-07', QUANTITYEXTENT: '40 units affected',
    WORKCENTERID: 'WC-HEAT-03', WORKCENTERDESC: 'Induction Hardening Cell 3', DEFECTCODE: 'DEF-0822',
    DEFECTTEXT: 'Insufficient case depth after induction hardening', MATERIALID: 'MAT-10402',
    MATERIALDESC: 'Drive Shaft S150', ROOTCAUSECATEGORY: 'Machine', COPQEUR: 12700, FMEAID: 'FMEA-HEAT-04',
};
const TEAM = {
    NOTIFICATIONID: '8D-10049160', PARTNERID: '100001', PARTNERNAME: 'Heli Weber',
    FUNCTIONTITLE: 'Quality Engineer & 8D Facilitator', PARTNERROLE: '8D Team Leader',
    EMAIL: 'heli.weber@proresolve.com', PHONE: '+49 89 2018 0001',
};
const ACTION = {
    NOTIFICATIONID: '8D-10049160', LINENO: 1, ACTIONTYPE: 'Containment',
    ACTIONTEXT: 'Quarantine 40 drive shafts', STATUS: 'Done', TASKCODE: 'TSK-1010',
    TASKCODEGROUP: 'QM-CONTAIN', TASKPROCESSOR: null, TIMEEFFORT: null, PLANNEDENDDATE: null,
};

/** Trả dòng với khoá đặt tên theo đúng luật của SQLite. */
function sqliteRow(sql: string, source: Record<string, unknown>): Record<string, unknown> {
    const selectList = sql.slice(sql.indexOf('SELECT') + 6, sql.indexOf('FROM'));
    const row: Record<string, unknown> = {};
    for (const item of selectList.split(/,(?![^(]*\))/)) {
        const alias = item.match(/AS\s+"(\w+)"\s*$/)?.[1];
        const column = item.match(/"(\w+)"/)?.[1] ?? '';
        const key = alias ?? DECLARED[column] ?? column;
        row[key] = source[alias ?? column];
    }
    return row;
}

jest.mock('@sap/cds', () => ({
    __esModule: true,
    default: {
        env: { requires: { db: { kind: 'sqlite' } } },
        connect: {
            to: async () => ({
                run: async (sql: string) => {
                    if (sql.includes('HISTORICALTEAMMEMBERS')) return [sqliteRow(sql, TEAM)];
                    if (sql.includes('HISTORICALACTIONS')) return [sqliteRow(sql, ACTION)];
                    return [sqliteRow(sql, CASE)];
                },
            }),
        },
    },
}));

import { hydratePrecedents } from '../hydrate';

describe('hydratePrecedents trên SQLite', () => {
    const scored = [{
        notificationId: '8D-10049160',
        score: 14,
        evidence: [{ kind: 'workCenter' as const, detail: 'WC-HEAT-03', count: 1, points: 1 }],
    }];

    it('không bỏ mất tiền lệ khi driver trả khoá theo tên khai báo của cột', async () => {
        const result = await hydratePrecedents(scored);
        expect(result.map((p) => p.notificationId)).toEqual(['8D-10049160']);
    });

    it('đọc đủ nội dung case, đội 8D và hành động', async () => {
        const [p] = await hydratePrecedents(scored);
        expect(p.sapStatus).toBe('Closed');
        expect(p.workCenterId).toBe('WC-HEAT-03');
        expect(p.copqEur).toBe(12700);
        expect(p.team).toEqual([expect.objectContaining({ partnerName: 'Heli Weber', partnerRole: '8D Team Leader' })]);
        expect(p.actions).toEqual([expect.objectContaining({ actionType: 'Containment', taskCode: 'TSK-1010' })]);
    });
});
