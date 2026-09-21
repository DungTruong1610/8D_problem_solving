# Mock data — 8D Golden Dataset

```
mock-data/
  clean/    12 case chỉn chu — đúng chuẩn Golden Dataset
  dirty/    12 case TƯƠNG ỨNG, ghi lại như dữ liệu SAP QM thật
  beta/     bộ cũ, đóng băng để đối chiếu
```

**`clean/` và `dirty/` mô tả CÙNG một sự thật.** Cùng chiếc dao mòn, cùng con số
0,32mm — chỉ khác cách ghi lại. Đó là điều kiện để so sánh có nghĩa: nếu AI đọc
được dữ liệu bẩn thì kết luận nguyên nhân gốc trên hai bộ phải trùng nhau.

Ghép cặp bằng tiền tố: `clean/case-8D-**1**0048412.json` ↔ `dirty/case-8D-**9**0048412.json`.

---

## Vì sao cần bộ bẩn

Golden Dataset được dựng **ngược từ các báo cáo 8D đã hoàn thành**, nên nó mang
theo cả đáp án lẫn một độ chỉn chu phi thực tế: đủ 6 nhánh Ishikawa, mọi trường
đều điền, định dạng thống nhất, số đo nằm đúng cột.

Ngày đầu tiên một defect thật xuất hiện trong SAP, dữ liệu không như vậy. Và
chính ở đó AI tạo ra giá trị không thể thay thế — một mapper viết bằng code chết
ngay với dữ liệu bẩn.

## Bộ bẩn khác gì

| | clean | dirty |
|---|---|---|
| Symptom | tiếng Anh đầy đủ | tiếng Đức viết tắt: `Grat an Flanschkante > Grenzwert n. Fraesen` |
| Ngày | `2026-08-03` | `03.08.2026` · `03-AUG-26` · lẫn lộn giữa các trường |
| Số | `0.32mm` | `0,32 mm` — dấu phẩy thập phân |
| Số đo | cột riêng `measured_value` | nằm trong câu: `Messung ergab 0,32 mm; lt. Zeichnung max 0,10 mm` |
| Spec | `max 0.10mm` | `lt. Zeichnung` — không có số |
| Ishikawa | đủ 6 nhánh | chỉ 2–3 nhánh được điều tra |
| Cờ root cause | `Y` | `x` · `ja` · **hoặc không ai đánh dấu** |
| 5-Why | 2–5 bước có bằng chứng | cụt còn 1 bước, hoặc không có |
| Action | `Containment` / `Corrective` / `Preventive` | `Sofortmassnahme` · `SM` · `KM` · để trống |
| Is/Is-Not | đầy đủ | thường không có |
| Ô trống | `null` | `""` · `-` · `n.a.` · `k.A.` |
| ID | `MAT-10247` | `  MAT-10247 ` · `wc-mill-07` |
| team_size | khớp số dòng | lệch, hoặc để trống |
| Cost / FMEA | có | hay thiếu |

**Bẩn không có nghĩa là sai.** Mỗi phép biến đổi giữ nguyên sự thật của case.

## Bốn case không ai đánh dấu nguyên nhân gốc

`8D-90048577` · `8D-90048603` · `8D-90048857` · `8D-90048903`

Kỹ sư điều tra xong nhưng quên kết luận. Đây là kịch bản đáng giá nhất: chẩn
đoán mù vẫn chạy được vì nó vốn dĩ không nhìn cờ đó — chỉ là không còn gì để đối
chiếu, nên **AI trở thành người duy nhất đưa ra kết luận** thay vì người phản
biện kết luận của kỹ sư.

## Hai case mập mờ (có ở cả hai bộ)

`8D-10048880` — kỹ sư ghi **Man**, nhưng dòng Man không có số liệu nào trong khi
dòng Machine có bộ đổi dao lệch 0,9mm so với giới hạn 0,2mm, và Is/Is-Not cho
thấy lỗi xuất hiện ở **cả ba ca** — mâu thuẫn với việc đổ lỗi cho một người.

`8D-10048903` — kỹ sư ghi **Method**, nhưng gloss meter có R&R 31% (trên ngưỡng
30% của MSA) và cùng những tấm panel đó đo ở lab lại **đạt**.

AI đã chọn Machine và Measurement trên hai case này, **lệch với kỹ sư**, và giải
thích được bằng số liệu.

---

## Validator: chặn cái gì

Chạy bộ `dirty/` qua luật cũ thì **cả 12 case đều bị chặn**:

```
ISHIKAWA-6-ROWS       19 lần
TEAM-SIZE-MATCH        7
ACTION-TYPE-COVERAGE   7
FIVE-WHY-RANGE         6
PK-UNIQUE              2
TEAM-ONE-LEADER        2
```

Nhìn kỹ thì hầu hết không phải lỗi dữ liệu. "Đúng 6 dòng Ishikawa" là quy ước
của Golden Dataset chứ không phải quy luật của SAP. `team_size` là ô gõ tay.
Case đang mở thì đương nhiên chưa đủ ba loại action.

Nên `srv/src/domain/eightd/datasetValidator.ts` đã đổi vai trò: **chỉ chặn khi
payload không phải một case**; mọi thứ khác thành cảnh báo chất lượng, chảy vào
`CaseContext.gaps` và gửi thẳng cho model.

`mock-data/generate.py` thì vẫn giữ luật cũ — nó gác cho bộ `clean/`, nơi độ
chỉn chu là mục đích.

---

## Sinh lại

```bash
python mock-data/generate.py
```

Đọc `cases_clean.py` (12 định nghĩa case) và khung metadata **nguyên xi** từ
`beta/case-8D-10048412.json`, rồi:

1. validate nghiêm ngặt → ghi `clean/`
2. áp `degrade.py` → ghi `dirty/`

Nhóm sửa schema ở file gốc thì chạy lại là cả 24 file tự cập nhật theo.

`degrade.py` dùng seed cố định, nên cùng một case sạch luôn cho ra cùng một bản
bẩn. Không có tính lặp lại thì không so sánh được giữa các lần chạy.

## Chạy thử

```bash
# so sánh trực tiếp một cặp
npx tsx scripts/run-analyze.ts mock-data/clean/case-8D-10048880.json
npx tsx scripts/run-analyze.ts mock-data/dirty/case-8D-90048880.json

# nạp cả hai bộ vào DB
npx tsx scripts/seed-reports.ts --clean
```

## Sửa hoặc thêm case

Sửa `cases_clean.py` rồi chạy lại `generate.py`. Đừng sửa tay file `case-*.json`
— lần chạy sau sẽ ghi đè.

`beta/` là ảnh chụp đóng băng của bộ cũ, script không đụng tới.
