# Sự vụ mới đến — dữ liệu để thử nghiệp vụ

Ba sự vụ **chưa có trong kho tiền lệ**. Đây là thứ dùng để thử luồng thật, khác
hẳn `clean/` và `dirty/`.

|  | `clean/` · `dirty/` | `incoming/` |
|---|---|---|
| Vai trò | **kho tiền lệ** — case đã đóng, có đáp án | **sự vụ mới** — vừa được ghi nhận |
| Có root cause chưa | rồi | **chưa** |
| Có 5-Why chưa | rồi | **chưa** |
| Có action chưa | rồi | **chưa** |
| Có nhóm 8D chưa | rồi | **chưa** |
| Nạp vào `HistoricalCases`? | có | **không** |

Đó là điểm mấu chốt: một sự vụ ngày đầu **chỉ có triệu chứng và bối cảnh**. Nếu
đem case đã hoàn chỉnh ra thử thì đang thử một tình huống không tồn tại — và
đang giấu mất câu hỏi thật: *với ngần ấy thông tin, hệ thống có tìm ra được gì
hữu ích không?*

## Ba sự vụ

| File | Origin | Bối cảnh | Kỳ vọng |
|---|---|---|---|
| `issue-A-internal-milling.json` | Q3 nội bộ | WC-MILL-07, Bracket Housing X240 — trùng dây chuyền và vật tư với cụm milling trong kho | Ra tiền lệ mạnh |
| `issue-B-customer-leak.json` | Q1 khiếu nại | Khách báo rò rỉ ở thân bơm đúc nhôm | Ra tiền lệ qua vật tư + mô tả |
| `issue-C-new-welding.json` | Q3 nội bộ | Dây chuyền hàn, vật tư và mã lỗi đều mới toanh | **Không** ra tiền lệ nào |

Sự vụ C tồn tại để kiểm chuyện khó hơn: hệ thống có dám nói *"không có tiền lệ"*
thay vì vơ đại case gần nhất không.

## Chạy

```bash
npx tsx scripts/run-e2e.ts                       # cả ba
npx tsx scripts/run-e2e.ts --only A              # một sự vụ
npx tsx scripts/run-e2e.ts --no-ai               # bỏ bước sinh báo cáo, chỉ tới tiền lệ
```

Xem `docs/8d-copilot-e2e-guide.md` để biết mỗi bước đang trả lời câu hỏi nghiệp
vụ nào.
