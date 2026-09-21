namespace cnma.proresolve;

using { cuid, managed } from '@sap/cds/common';

// ── @cnma/cap-identity CDS imports ───────────────────────────────────────────
using { cnma.identity.ShadowUsers }      from '@cnma/cap-identity/db/identity';
using { cnma.identity.ShadowGroups }     from '@cnma/cap-identity/db/identity';
using { cnma.identity.GroupMembers }      from '@cnma/cap-identity/db/identity';
using { cnma.identity.SupportTypes }      from '@cnma/cap-identity/db/identity';
using { cnma.identity.SamlGroupMappings } from '@cnma/cap-identity/db/identity';

// ── @cnma/cap-valuehelp CDS imports ──────────────────────────────────────────
using { cnma.valuehelp.ValueHelpList }   from '@cnma/cap-valuehelp/db/valuehelp';

// ── Cấu hình AI dùng chung ───────────────────────────────────────────────────
using from './ai-settings';

// ── Lỗi chất lượng đã ghi nhận (QMEL) — nguồn của một báo cáo 8D ─────────────
using from './defects';

// ── Mô hình báo cáo 8D ───────────────────────────────────────────────────────
using from './eight-d';

// ── Kho case lịch sử (nguồn tìm tiền lệ) ─────────────────────────────────────
using from './case-library';

// ── Cấu hình chấm điểm tương đồng + prompt từng bước D ───────────────────────
using from './retrieval-config';

// ── Công tắc engine truy hồi (chấm điểm ⟷ graph) ────────────────────────────
using from './graph-config';

// ── Đánh giá pipeline: tuân thủ + chất lượng + độ trùng đáp án ───────────────
using from './eval';

// ── Lịch sử kiểm tra lô & Sổ FMEA ──────────────────────────────────────────
using from './inspection-lots';

// ── Dải số do server cấp (thay cho max()+1 trong trình duyệt) ────────────────
using from './number-ranges';

// ── Application Entities ──────────────────────────────────────────────────────
entity SampleEntity : cuid, managed {
    name        : String(255);
    description : String(1000);
    status      : String(20) default 'Draft';
}
