/**
 * Khoá lại hợp đồng "AI viết câu, LUẬT gán mã".
 *
 * ── Vì sao bộ test này tồn tại ──
 * Cách hiển nhiên để có mã nhiệm vụ trên mỗi hành động là thêm một ô `taskCode`
 * vào schema đầu ra của D3/D5/D7. Cách đó hỏng theo kiểu khó thấy nhất: model
 * luôn điền được một mã nghe hợp lý, kể cả khi nó chọn nhầm — và lúc đó có HAI
 * nguồn mã (model và `classifyTaskCode`) không đối chiếu được với nhau.
 *
 * Quyết định là: chỉ một nguồn, và nguồn đó là bộ luật. Quyết định ấy nằm rải ở
 * ba chỗ (schema form, prompt, và `taskFromAction`), nên nó sẽ bị phá bởi một
 * người thêm "cho đủ trường" mà không biết vì sao nó không có ở đó. Test này là
 * chỗ người ấy đọc được lý do.
 *
 * ── Vì sao khoá cả câu "động từ mệnh lệnh đứng đầu" ──
 * `classifyTaskCode` cắt MỆNH ĐỀ ĐẦU rồi mới đối chiếu. Bỏ câu hướng dẫn đó thì
 * bộ luật vẫn chạy, vẫn không báo lỗi, chỉ là gán nhầm ô — đúng loại hỏng mà
 * không màn hình nào hiện ra.
 */

import { DEFAULT_STEP_PROMPTS } from '../precedent/defaults';
import { classifyTaskCode } from '../../../../../shared/task-catalogue';

/** Ba bước sinh ra hành động — và chỉ ba bước đó. */
const ACTION_STEPS = ['D3', 'D5', 'D7'] as const;

const step = (code: string) => {
    const found = DEFAULT_STEP_PROMPTS.find((s) => s.stepCode === code);
    if (!found) throw new Error(`Không có cấu hình mặc định cho ${code}`);
    return found;
};

describe('hợp đồng mã nhiệm vụ trên D3/D5/D7', () => {
    it.each(ACTION_STEPS)('%s dặn model để việc chính lên đầu câu', (code) => {
        // Khoá Ý, không khoá câu chữ: prompt còn được viết lại nhiều lần.
        const prompt = step(code).combinedPrompt ?? '';
        expect(prompt).toMatch(/PRIMARY work/);
        expect(prompt).toMatch(/leading clause/);
    });

    it.each(ACTION_STEPS)('%s cấm model tự đặt mã nhiệm vụ', (code) => {
        expect(step(code).combinedPrompt ?? '').toMatch(/Never output a task code/);
    });

    it.each(ACTION_STEPS)('%s không khai taskCode trong schema đầu ra của AI', (code) => {
        // Đây mới là ràng buộc thật: prompt là lời khuyên, schema là thứ model bị
        // chặn lúc sinh token. Một ô `taskCode` lọt vào đây thì câu dặn ở trên
        // thành vô nghĩa.
        const contract = step(code).inputSchemaJson ?? '';
        expect(contract).not.toMatch(/taskCode/);
        expect(contract).not.toMatch(/taskCodeGroup/);
        expect(contract).not.toMatch(/plannedEndDate/);
    });
});

describe('vì sao câu dặn đó đáng có', () => {
    // Không phải một khẳng định trừu tượng: đây là chính cặp câu mà luật xử lý
    // khác nhau, nên nếu ai nới `headClause` ra thì test này đỏ chứ không phải
    // một case thật nào đó lặng lẽ vào sai nhóm.
    it('mệnh đề đầu quyết định mã, không phải nửa sau của câu', () => {
        const rework = classifyTaskCode('Rework 48 bridged boards and re-test continuity');
        const retest = classifyTaskCode('Re-test continuity on 48 boards after rework');
        expect(rework?.taskCode).not.toEqual(retest?.taskCode);
    });
});
