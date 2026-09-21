import { DISCIPLINE_CODES, type DisciplineCode } from '../types';
import { STEP_DEPENDENCIES, planStepWaves } from '../stepGraph';

describe('planStepWaves', () => {
    it('phát đủ tám bước, không trùng, không thiếu', () => {
        const flat = planStepWaves().flat();
        expect(flat.slice().sort()).toEqual([...DISCIPLINE_CODES].sort());
        expect(new Set(flat).size).toBe(flat.length);
    });

    it('mọi phụ thuộc đều nằm ở đợt trước — điều kiện đúng đắn của cả kế hoạch', () => {
        const waves = planStepWaves();
        const waveOf = new Map<DisciplineCode, number>();
        waves.forEach((wave, index) => wave.forEach((code) => waveOf.set(code, index)));

        for (const code of DISCIPLINE_CODES) {
            for (const dep of STEP_DEPENDENCIES[code]) {
                expect(waveOf.get(dep)!).toBeLessThan(waveOf.get(code)!);
            }
        }
    });

    it('cắt bớt số lượt gọi tuần tự so với chạy nối đuôi D1→D8', () => {
        // Đây chính là lý do file này tồn tại. Chạy nối đuôi là 8 lượt; đồ thị
        // hiện tại còn 5. Thêm một phụ thuộc làm đồ thị thành chuỗi thẳng thì
        // test này đổ trước khi người dùng kịp thấy chậm.
        expect(planStepWaves().length).toBeLessThan(DISCIPLINE_CODES.length);
        expect(planStepWaves().length).toBeLessThanOrEqual(5);
    });

    it('không đợt nào rộng quá giới hạn đồng thời mặc định của AI Core (3)', () => {
        for (const wave of planStepWaves()) expect(wave.length).toBeLessThanOrEqual(3);
    });

    it('D1 và D2 nằm ngay đợt đầu để UI có nội dung sớm nhất', () => {
        expect(planStepWaves()[0].sort()).toEqual(['D1', 'D2']);
    });

    it('bỏ qua phụ thuộc nằm ngoài tập được yêu cầu — sinh lại một phần vẫn chạy', () => {
        // D5 phụ thuộc D4, nhưng D4 không được yêu cầu ⇒ D5 về mức 0.
        expect(planStepWaves(['D5', 'D6'])).toEqual([['D5'], ['D6']]);
    });

    it('giữ nguyên thứ tự khai báo bên trong một đợt', () => {
        expect(planStepWaves(['D2', 'D1'])).toEqual([['D2', 'D1']]);
    });

    it('tập rỗng cho kế hoạch rỗng, không phải một đợt rỗng', () => {
        expect(planStepWaves([])).toEqual([]);
    });

    it('ném lỗi khi đồ thị có chu trình thay vì lặng lẽ bỏ bước', () => {
        const cyclic = { ...STEP_DEPENDENCIES, D1: ['D2'], D2: ['D1'] } as Record<DisciplineCode, readonly DisciplineCode[]>;
        expect(() => planStepWaves(DISCIPLINE_CODES, cyclic)).toThrow(/vòng/);
    });

    it('không bước nào tự phụ thuộc chính nó', () => {
        for (const code of DISCIPLINE_CODES) {
            expect(STEP_DEPENDENCIES[code]).not.toContain(code);
        }
    });

    it('phụ thuộc chỉ trỏ về bước có số nhỏ hơn — 8D không bao giờ chạy ngược', () => {
        for (const code of DISCIPLINE_CODES) {
            for (const dep of STEP_DEPENDENCIES[code]) {
                expect(DISCIPLINE_CODES.indexOf(dep)).toBeLessThan(DISCIPLINE_CODES.indexOf(code));
            }
        }
    });
});

/**
 * Các cạnh nghiệp vụ, khoá từng cạnh một.
 *
 * Test tổng quát ở trên chỉ khẳng định "phụ thuộc nào cũng nằm ở đợt trước" —
 * nó vẫn xanh nếu ai đó XOÁ một cạnh. Mà xoá cạnh mới là cách hỏng dễ xảy ra:
 * cắt một phụ thuộc luôn trông như một cải tiến tốc độ, và hậu quả — hai bước
 * của cùng một báo cáo nói hai chuyện khác nhau — thì không lộ ra ở test nào
 * khác, chỉ lộ trước mặt khách hàng.
 */
describe('STEP_DEPENDENCIES — cạnh nghiệp vụ không được biến mất', () => {
    it('D3 và D4 đều chờ D2 — không truy nguyên nhân cho vấn đề chưa mô tả xong', () => {
        expect(STEP_DEPENDENCIES.D3).toContain('D2');
        expect(STEP_DEPENDENCIES.D4).toContain('D2');
    });

    it('D5 chờ cả D3 lẫn D4 — gỡ đúng nguyên nhân, và biết cái gì đã chặn tạm', () => {
        expect([...STEP_DEPENDENCIES.D5].sort()).toEqual(['D3', 'D4']);
    });

    it('D6 và D7 đều chờ D4 và D5 — xác minh và phòng ngừa cần cả nguyên nhân lẫn bản sửa', () => {
        for (const code of ['D6', 'D7'] as const) {
            expect(STEP_DEPENDENCIES[code]).toContain('D4');
            expect(STEP_DEPENDENCIES[code]).toContain('D5');
        }
    });

    it('D8 chờ đủ D5, D6, D7 — đóng case tổng kết việc đã làm và việc còn dở', () => {
        for (const dep of ['D5', 'D6', 'D7'] as const) {
            expect(STEP_DEPENDENCIES.D8).toContain(dep);
        }
    });

    it('siết chặt phụ thuộc KHÔNG làm tăng số đợt — chặt hơn mà không chậm hơn', () => {
        // Lý do đáng ghi lại: cạnh D5→D7 từng bị cắt để "tiết kiệm một đợt".
        // Nó không tiết kiệm được gì, vì D6 vẫn nằm ở đợt đó. Cắt một cạnh
        // nghiệp vụ để đổi lấy tốc độ thì ít nhất phải có tốc độ thật.
        expect(planStepWaves().length).toBe(5);
    });

    it('D1 và D2 vẫn không chờ ai — giá trị sớm nhất người dùng nhìn thấy', () => {
        expect(STEP_DEPENDENCIES.D1).toEqual([]);
        expect(STEP_DEPENDENCIES.D2).toEqual([]);
    });
});

/**
 * Nối đồ thị với cái mà runtime thật sự truyền đi.
 *
 * `generateReportProgressive` chụp danh sách bước đã xong tại ĐẦU MỖI ĐỢT rồi
 * đưa nguyên vào prompt của mọi bước trong đợt đó. Nên thứ một bước nhìn thấy
 * chính là hợp của tất cả các đợt trước nó — không phải chỉ những bước nó khai.
 *
 * Test này mô phỏng đúng phép đó và khẳng định: khai một phụ thuộc thì bước ấy
 * CHẮC CHẮN thấy nó. Không có bất biến này thì bảng phụ thuộc chỉ là chú thích
 * — nó xếp thứ tự chạy mà không bảo đảm được điều nó hứa.
 */
describe('bước nhìn thấy đúng những gì nó phụ thuộc', () => {
    const waves = planStepWaves();

    /** Đúng phép chụp của runtime: mọi bước ở các đợt TRƯỚC đợt thứ `index`. */
    const visibleAtWave = (index: number) => new Set(waves.slice(0, index).flat());

    it.each(DISCIPLINE_CODES.map((code) => [code] as const))(
        '%s thấy đủ mọi bước nó khai phụ thuộc',
        (code) => {
            const waveIndex = waves.findIndex((wave) => wave.includes(code));
            const visible = visibleAtWave(waveIndex);
            for (const dep of STEP_DEPENDENCIES[code]) expect(visible.has(dep)).toBe(true);
        },
    );

    it('D4 luôn thấy D2 — không thể mô tả vấn đề một nẻo rồi kết luận một nẻo', () => {
        const waveOfD4 = waves.findIndex((wave) => wave.includes('D4'));
        expect(visibleAtWave(waveOfD4).has('D2')).toBe(true);
    });

    it('D5 và D6 thấy đủ D1..D4 — hành động neo vào cả bốn bước đầu', () => {
        for (const code of ['D5', 'D6'] as const) {
            const visible = visibleAtWave(waves.findIndex((wave) => wave.includes(code)));
            for (const dep of ['D1', 'D2', 'D3', 'D4'] as const) expect(visible.has(dep)).toBe(true);
        }
    });

    it('D8 thấy trọn bảy bước trước nó', () => {
        const visible = visibleAtWave(waves.findIndex((wave) => wave.includes('D8')));
        expect(visible.size).toBe(DISCIPLINE_CODES.length - 1);
    });

    it('bước cùng đợt KHÔNG thấy nhau — nếu không kết quả phụ thuộc bước nào xong trước', () => {
        for (const wave of waves) {
            if (wave.length < 2) continue;
            const visible = visibleAtWave(waves.indexOf(wave));
            for (const code of wave) expect(visible.has(code)).toBe(false);
        }
    });
});
