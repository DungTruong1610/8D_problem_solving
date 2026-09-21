/**
 * Hai hàm suy ra cột worklist của `Reports`: `isoDateOrNull` và `teamLeaderRefFrom`.
 *
 * ── Vì sao đáng test ──
 * Cả hai đọc JSON tự do và ghi ra một CỘT. Cột thì được `$orderby` và `$filter`
 * theo — nghĩa là sai ở đây không hiện thành lỗi, nó hiện thành một danh sách
 * sắp xếp sai hoặc một bộ lọc bỏ sót case. Không có màn hình nào nói "giá trị
 * này suy ra sai"; case chỉ đơn giản không xuất hiện ở chỗ người ta tìm.
 *
 * Riêng `isoDateOrNull`: nguồn của nó là `customer.slaResponseDue`, một chuỗi tự
 * do mang sentinel 'N/A' ở case nội bộ. Ép sentinel thành ngày là bịa ra một hạn
 * cho case vốn không có hạn — và một hạn bịa thì trông y hệt hạn thật.
 */

import {
    customerRefOrNull,
    isoDateOrNull,
    teamLeaderFrom,
    teamLeaderRefFrom,
} from '../eightDRepository';

describe('isoDateOrNull', () => {
    it('nhận ngày ISO đúng dạng', () => {
        expect(isoDateOrNull('2026-05-04')).toBe('2026-05-04');
    });

    it('cắt khoảng trắng thừa quanh ngày', () => {
        expect(isoDateOrNull('  2026-05-04 ')).toBe('2026-05-04');
    });

    // Đây là lý do cột tồn tại ở dạng Date: sentinel phải thành null, không thành
    // hạn. Hai chuỗi dưới là hai giá trị có thật trong dữ liệu hiện tại.
    it.each(['N/A', 'N/A - Internal Defect'])('bỏ sentinel %s', (raw) => {
        expect(isoDateOrNull(raw)).toBeNull();
    });

    it('bỏ ngày khớp regex nhưng không tồn tại', () => {
        expect(isoDateOrNull('2026-13-45')).toBeNull();
    });

    it('bỏ mọi dạng không phải chuỗi ngày', () => {
        expect(isoDateOrNull('04.05.2026')).toBeNull();
        expect(isoDateOrNull('2026-05-04T08:00:00Z')).toBeNull();
        expect(isoDateOrNull('')).toBeNull();
        expect(isoDateOrNull(null)).toBeNull();
        expect(isoDateOrNull(undefined)).toBeNull();
        expect(isoDateOrNull(20260504)).toBeNull();
        expect(isoDateOrNull(new Date('2026-05-04'))).toBeNull();
    });
});

describe('customerRefOrNull', () => {
    it('giữ nguyên số hiệu khiếu nại thật', () => {
        expect(customerRefOrNull('CC-2026-0442')).toBe('CC-2026-0442');
        expect(customerRefOrNull('  CC-2026-0442  ')).toBe('CC-2026-0442');
    });

    // Chuỗi đầu tiên là giá trị có thật ở 16/26 báo cáo hiện có. Ba chuỗi sau là
    // các biến thể mà người và model sẽ viết ra — bắt cả họ bằng một luật, chứ
    // không bằng một danh sách phải bảo trì.
    it.each([
        'N/A - internal defect, no customer reference',
        'N/A',
        'n/a',
        'NA',
    ])('bỏ sentinel %s', (raw) => {
        expect(customerRefOrNull(raw)).toBeNull();
    });

    // 'NAVISTAR-2026-11' bắt đầu bằng 'NA' nhưng là số hiệu thật. Ranh giới từ
    // trong regex là thứ giữ nó lại — không có nó, một khách hàng mất số hiệu.
    it('không bắt nhầm số hiệu chỉ vì nó bắt đầu bằng NA', () => {
        expect(customerRefOrNull('NAVISTAR-2026-11')).toBe('NAVISTAR-2026-11');
    });

    it('trả null cho rỗng và cho thứ không phải chuỗi', () => {
        expect(customerRefOrNull('')).toBeNull();
        expect(customerRefOrNull('   ')).toBeNull();
        expect(customerRefOrNull(null)).toBeNull();
        expect(customerRefOrNull(undefined)).toBeNull();
        expect(customerRefOrNull(4420)).toBeNull();
    });

    // Cột là NVARCHAR(50). Cắt ở đây chứ không để driver ném lỗi ở giữa một lần
    // ghi báo cáo — một số hiệu dài bất thường không đáng làm hỏng cả case.
    it('cắt đúng độ dài cột', () => {
        expect(customerRefOrNull('C'.repeat(80))).toHaveLength(50);
    });
});

describe('teamLeaderRefFrom', () => {
    const withRoster = (roster: unknown) => JSON.stringify({ team: { assignedRoster: roster } });

    it('tách tên và số hiệu của đúng người giữ vai trò trưởng nhóm', () => {
        const json = withRoster([
            { partnerId: '100012', partnerRole: '8D Team Member', partnerName: 'Ana Ruiz' },
            { partnerId: '100014', partnerRole: '8D Team Leader', partnerName: 'Heli Weber' },
        ]);
        expect(teamLeaderRefFrom(json)).toEqual({ name: 'Heli Weber', partnerId: '100014' });
    });

    // Dữ liệu thật hiện tại: bảng nhân sự chỉ lưu số hiệu, tên là dữ liệu chủ.
    // Giữ được `partnerId` ở đây là điều kiện để tra ra tên sau đó.
    it('giữ số hiệu khi bảng nhân sự không lưu tên', () => {
        const json = withRoster([{ partnerId: '100014', partnerRole: '8D Team Leader' }]);
        expect(teamLeaderRefFrom(json)).toEqual({ name: null, partnerId: '100014' });
    });

    it('gọt tiền tố BP- để khớp danh bạ', () => {
        const json = withRoster([{ partnerId: 'BP-100014', partnerRole: '8D Team Leader' }]);
        expect(teamLeaderRefFrom(json)?.partnerId).toBe('100014');
    });

    it('trả null khi roster chỉ có thành viên, chưa có trưởng nhóm', () => {
        const json = withRoster([{ partnerId: '100012', partnerRole: '8D Team Member' }]);
        expect(teamLeaderRefFrom(json)).toBeNull();
    });

    it('trả null khi dòng trưởng nhóm rỗng cả tên lẫn số hiệu', () => {
        const json = withRoster([{ partnerId: '  ', partnerName: '', partnerRole: '8D Team Leader' }]);
        expect(teamLeaderRefFrom(json)).toBeNull();
    });

    // Không được ném: hàm này chạy trên mọi lần ghi roster. Một `resultJson` hỏng
    // ở một case mà làm đổ cả lượt ghi thì hỏng lan sang case khác.
    it('không ném với JSON hỏng hoặc hình dạng lạ', () => {
        expect(teamLeaderRefFrom('{ not json')).toBeNull();
        expect(teamLeaderRefFrom(null)).toBeNull();
        expect(teamLeaderRefFrom('{}')).toBeNull();
        expect(teamLeaderRefFrom(withRoster('không phải mảng'))).toBeNull();
        expect(teamLeaderRefFrom(withRoster([null, 7, 'x']))).toBeNull();
    });

    it('đọc được object đã parse sẵn, không chỉ chuỗi', () => {
        const data = { team: { assignedRoster: [{ partnerId: '100014', partnerRole: '8D Team Leader' }] } };
        expect(teamLeaderRefFrom(data)?.partnerId).toBe('100014');
    });
});

describe('teamLeaderFrom', () => {
    const withRoster = (roster: unknown) => JSON.stringify({ team: { assignedRoster: roster } });

    it('ưu tiên tên khi có tên', () => {
        const json = withRoster([{ partnerId: '100014', partnerName: 'Heli Weber', partnerRole: '8D Team Leader' }]);
        expect(teamLeaderFrom(json)).toBe('Heli Weber');
    });

    // Rơi về số hiệu thay vì để trống: ô trống nói "chưa chốt trưởng nhóm", còn
    // ở đây trưởng nhóm ĐÃ chốt — chỉ là chưa tra được tên.
    it('rơi về số hiệu khi không có tên', () => {
        const json = withRoster([{ partnerId: '100014', partnerRole: '8D Team Leader' }]);
        expect(teamLeaderFrom(json)).toBe('100014');
    });

    it('trả null khi chưa chốt', () => {
        expect(teamLeaderFrom('{}')).toBeNull();
    });
});
