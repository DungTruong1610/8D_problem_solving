# Mock data — 8D Golden Dataset

12 case dùng để phát triển và demo pipeline 8D.

| File | Origin | Root cause | Status | Ghi chú |
|---|---|---|---|---|
| `case-8D-10048412.json` | Q3 | Machine | In Process | **File gốc của nhóm** |
| `case-8D-10048577.json` | Q1 | Material | Completed | Hydro trong phôi nhôm |
| `case-8D-10048603.json` | Q3 | Method | Closed | 4 bước 5-Why |
| `case-8D-10048651.json` | Q1 | Measurement | In Process | **Thiếu Preventive + FMEA — cố ý** |
| `case-8D-10048702.json` | Q3 | Man | Closed | Bỏ bước siết lực |
| `case-8D-10048745.json` | Q1 | Environment | Completed | Độ ẩm khi đóng rắn keo |
| `case-8D-10048788.json` | Q3 | Machine | In Process | Rung ổ trục; thiếu Preventive + FMEA |
| `case-8D-10048811.json` | Q1 | Method | Closed | Bản vẽ sai sau đổi thiết kế |
| `case-8D-10048834.json` | Q3 | Material | Completed | Giao nhầm mác thép |
| `case-8D-10048857.json` | Q1 | Measurement | In Process | CMM sai datum; thiếu Preventive + FMEA |
| `case-8D-10048880.json` | Q3 | Man | Completed | ⚠ **MẬP MỜ — xem bên dưới** |
| `case-8D-10048903.json` | Q1 | Method | In Process | ⚠ **MẬP MỜ — xem bên dưới** |

**Phủ sóng:** 6/6 nhánh Ishikawa · Q1 và Q3 đều 6 case · cả ba trạng thái SAP.

---

## Hai case mập mờ — quan trọng nhất

Pipeline có một bước **chẩn đoán mù**: AI chỉ nhận bằng chứng thô, còn chuỗi
5-Why, cờ `is_root_cause`, action khắc phục, FMEA và lessons learned đều bị cắt
(xem `srv/src/domain/eightd/blindEvidence.ts`). Nó phải tự tìm ra nguyên nhân
gốc, rồi code đối chiếu với đáp án của kỹ sư.

Nếu mọi case đều rõ ràng và AI luôn đồng ý, ta **không phân biệt được** "AI suy
luận đúng" với "AI đoán bừa rồi may". Hai case dưới đây tạo ra sự khác biệt đó.

### `8D-10048880` — kỹ sư ghi **Man**

Kỹ sư kết luận thao tác viên nạp nhầm chương trình NC. Nhưng:

- Dòng Man **không có số liệu nào** — chỉ ghi "suspected", và chính nó thừa nhận
  *"no MES record of a program change was found"*.
- Dòng Machine có số **vượt ngưỡng rõ ràng**: bộ đổi dao lệch 0.9mm so với giới
  hạn 0.2mm, xác nhận qua ba chu kỳ thử.
- Is/Is-Not ghi lỗi xuất hiện ở **cả ba ca**, không riêng ca C — mâu thuẫn trực
  tiếp với giả thuyết đổ cho một thao tác viên.
- `lessons_learned.what_didnt` tự nói ra: *"the investigation closed on the
  operator explanation before the tool changer data was reviewed"*.

Kỳ vọng: AI chọn **Machine** và **lệch** với kỹ sư.

### `8D-10048903` — kỹ sư ghi **Method**

Kỹ sư quy cho việc rút ngắn thời gian flash-off. Nhưng:

- Dòng Measurement cho thấy gloss meter có **R&R 31%**, trên ngưỡng 30% mà MSA
  coi là không chấp nhận được — nghĩa là chính con số dùng để kết luận không
  đáng tin.
- Is/Is-Not ghi cùng những tấm panel đó đo ở phòng lab ra **84–87 GU, tức là
  ĐẠT**. Lỗi bám theo *thiết bị đo*, không bám theo buồng sơn.

Kỳ vọng: AI chọn **Measurement**, hoặc ít nhất nêu Measurement làm khả dĩ thứ
hai và đòi giải quyết mâu thuẫn giữa hai phép đo trước.

> Đây là kiểu sai lầm rất người: kết luận dựa trên số đo mà chưa kiểm chứng hệ đo.
> AI bắt được thì đó là giá trị thật, không phải trình diễn.

**Lưu ý:** cả hai case vẫn **hợp lệ** theo 13 ràng buộc toàn vẹn. Chúng không
phải dữ liệu hỏng — chúng là dữ liệu *đúng định dạng nhưng kết luận đáng ngờ*,
đúng như thực tế hay gặp.

---

## Sinh lại

```bash
python mock-data/generate.py
```

Script lấy `meta` / `schema` / `relationships` / `integrity` **nguyên xi** từ
`case-8D-10048412.json` rồi chỉ thay `data` và `nested_case_view`. Nhờ vậy khi
nhóm sửa schema ở file gốc, chạy lại script là 11 case kia tự cập nhật theo.

`data` và `nested_case_view` cũng dựng từ **cùng một** định nghĩa trong
`cases.py` / `cases_extra.py`, nên hai khối này không thể mâu thuẫn nhau.

## Validator

`generate.py` implement đủ 13 ràng buộc trong `integrity.constraints` và chạy
trước khi ghi file. Case vi phạm thì script fail, không ghi ra file rác.

Nó cũng **tự kiểm chứng bằng file gốc**: nếu `case-8D-10048412.json` của nhóm
không pass validator thì script dừng ngay — nghĩa là validator hiểu sai luật,
chứ không phải dữ liệu sai.

## Sửa hoặc thêm case

Sửa `cases.py` (4 case đầu) hoặc `cases_extra.py` (8 case sau), rồi chạy lại
`generate.py`. Đừng sửa tay các file `case-*.json` sinh ra — lần chạy sau sẽ ghi
đè.

Ngoại lệ: `case-8D-10048412.json` là file gốc của nhóm, script chỉ đọc chứ không
ghi đè.
