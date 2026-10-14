# happycase-full — 10 case 8D "happy path" đầy đủ dữ liệu

Mỗi file là một 8D **đang mở** (`In Process`) có đủ hồ sơ để mọi bước D1–D8
đều có tiền lệ, có người được giao việc, và có dòng Evidence trỏ vào dữ liệu thật.

**Cách dùng:** Create 8D Report → nút `{}` → dán hoặc upload file
(`POST /api/cnma/EIGHTD_SRV/analyzeFromJson`).

> Không nhập qua Record Defect → Start 8D. Đường đó (`srv/src/domain/defectPayload.ts`)
> luôn gửi `teamAssignments: []` và `isIsNot: null`, nên D1 Leader/Members và dòng
> Is/Is-Not sẽ lại hiện "No value recorded".

## Bộ case

| File | Notification | Origin | Work center / thiết bị lỗi | Tiền lệ mong đợi |
|---|---|---|---|---|
| `happy_full_01_adhesive_bond_failure_dispenser1` | 8D-10049401 | Q1 | WC-BOND-02 · DISPENSER1 | 8D-10049330, 8D-10048745 |
| `happy_full_02_die_casting_leak_die1_vent` | 8D-10049402 | Q3 | WC-CAST-03 · DIE1 | 8D-10049140, 8D-10048577 |
| `happy_full_03_cnc_turning_od_undersize` | 8D-10049403 | Q1 | WC-TURN-02 · L1 | 8D-10049150, 8D-10048603 |
| `happy_full_04_induction_case_depth_coil1` | 8D-10049404 | Q3 | WC-HEAT-03 · COIL1 | 8D-10049160, 8D-10049080 |
| `happy_full_05_smt_solder_bridging_printer1` | 8D-10049405 | Q3 | WC-SMT-02 · PRINTER1 | 8D-10049170, 8D-10049050 |
| `happy_full_06_injection_sink_mark_cavity1` | 8D-10049406 | Q1 | WC-MOLD-01 · CAV1 | 8D-10049180, 8D-10049040 |
| `happy_full_07_anodizing_pitting_tank3` | 8D-10049407 | Q1 | WC-ANOD-01 · TANK3 | 8D-10049190, 8D-10049070 |
| `happy_full_08_grinding_burn_wheel1` | 8D-10049408 | Q3 | WC-GRIND-01 · WHEEL1 | 8D-10049300, 8D-10049110 |
| `happy_full_09_stamping_flange_crack_tool1` | 8D-10049409 | Q3 | WC-PRESS-09 · TOOL1 | 8D-10049310, 8D-10048834 |
| `happy_full_10_gearbox_bolt_torque_spindle1` | 8D-10049410 | Q1 | WC-ASSY-08 · SPINDLE1 | 8D-10049320, 8D-10048702 |

Không có case bong sơn (WC-COAT-05) trong bộ này, và đó là cố ý. 8D-10048651 là case
demo "không có tiền lệ" của acceptance criteria #7 (`precedent/__tests__/scoring.test.ts`);
chỉ cần một case đóng trên WC-COAT-05 là nó nhận 11 điểm và demo đó hỏng.

Mười tiền lệ `8D-10049140..330` được thêm vào `cases_clean.py` cùng đợt này. Mỗi tiền
lệ cùng work center, cùng mã lỗi và cùng vật tư với case input, mang đúng cơ chế hỏng
của case input, và có đủ đội 8D, ba loại action có task code, FMEA và COPQ.

## Mỗi file mang gì, và để lấp chỗ nào

| Key | Lấp chỗ nào trên UI |
|---|---|
| `teamAssignments` (1 leader + 3 member, ID của `STANDARD_TEAM_DIRECTORY`) | D1 Evidence "Team member · Leader / Members"; owner D3/D5/D7 không còn "Unassigned" |
| `inspections` (dòng Rejected có `equipment`) | D2 "Measurement taken"; chọn đặc tính chính cho Is/Is-Not |
| `historicalInspectionLots` (2 thiết bị × 3 lô, `conforming` là boolean) | D2 Is / Is-Not được tính, không còn "Not analysed" |
| `isIsNot` | Evidence "Where the problem does and does not happen" |
| `causesIshikawa`, `fiveWhyChain` | D4 Evidence "Cause branch / Why-step on record" |
| `actions` (Containment Done, Corrective In Process, Preventive Planned) | D3/D5/D7 Evidence "Action on the notification" |
| `fmeaLink`, `customerReference`, `responsibility`, `costCopq`, `lessonsLearned` | D7 FMEA, D8 closure, các dòng "Case closure detail" |

`lessonsLearned` ghi rõ "Interim (case open)", vì case chưa đóng nhưng D8 vẫn được
phép trích dẫn trường này.

## Ràng buộc khi sửa

- `characteristic` của dòng Rejected đầu tiên phải trùng **từng chữ** với
  `historicalInspectionLots[].characteristic` (Is/Is-Not so sánh chuỗi).
- Lô kiểm tra trong file được chép từ `db/data/cnma.proresolve-InspectionLots.csv`
  (sinh bởi `scripts/generate-comprehensive-seed.mjs`). Sửa ở generator trước, rồi
  sửa file sau, để tab Inspection History và case luôn khớp nhau.
- Mỗi characteristic chỉ xuất hiện một lần trong `inspections`. Validator báo trùng,
  và mọi dòng Rejected khác dòng chính đều thành gap "was not compared".
