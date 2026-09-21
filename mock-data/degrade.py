"""
Biến một case SẠCH thành phiên bản BẨN — mô phỏng dữ liệu SAP QM thật.

── Vì sao cần bộ dữ liệu bẩn ──
Golden Dataset của nhóm được dựng ngược từ các báo cáo 8D đã hoàn thành, nên nó
sạch một cách phi thực tế: đủ 6 nhánh Ishikawa, mọi trường đều điền, định dạng
thống nhất, số đo nằm đúng cột. Ngày đầu một defect thật xuất hiện trong SAP,
dữ liệu không như vậy.

Một mapper viết bằng code chết ngay với dữ liệu bẩn. AI thì bóc được. Đó chính
là chỗ AI tạo ra giá trị không thể thay thế — và nó chỉ chứng minh được nếu ta
có dữ liệu bẩn để thử.

── Nguyên tắc ──
Bẩn KHÔNG có nghĩa là sai. Mỗi phép biến đổi dưới đây giữ nguyên SỰ THẬT của
case, chỉ thay đổi CÁCH nó được ghi lại. Cùng một chiếc dao mòn, cùng một con số
0,32mm — chỉ là lần này nó nằm trong một câu tiếng Đức viết tắt thay vì một cột
tên `measured_value`.

Nhờ vậy ta so sánh được: chạy cả hai phiên bản, kết luận của AI phải giống nhau.
Khác nhau nghĩa là AI không đọc nổi dữ liệu bẩn, và đó là thông tin đáng giá.
"""

import copy
import random
import re

# Cố định seed: cùng một case sạch luôn cho ra cùng một bản bẩn. Không có tính
# lặp lại thì không so sánh được giữa các lần chạy.
RNG = random.Random(8_2026)


# ─────────────────────────────────────────────────────────────────────────────
# Các phép làm bẩn nguyên tử
# ─────────────────────────────────────────────────────────────────────────────

def de_number(value: str) -> str:
    """Dấu thập phân kiểu Đức: `0.32mm` → `0,32 mm`."""
    return re.sub(r"(\d)\.(\d)", r"\1,\2", str(value))


def messy_date(iso: str | None, style: int) -> str | None:
    """
    Ngày ở định dạng địa phương. SAP xuất ra đủ kiểu tuỳ transaction và locale.

    0 → 03.08.2026   (Đức, phổ biến nhất)
    1 → 03-AUG-26    (kiểu ALV cũ)
    2 → giữ ISO
    """
    if not iso:
        return iso
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", str(iso))
    if not m:
        return iso
    y, mo, d = m.groups()
    if style == 0:
        return f"{d}.{mo}.{y}"
    if style == 1:
        months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return f"{d}-{months[int(mo) - 1]}-{y[2:]}"
    return iso


def pad_id(value: str) -> str:
    """Khoảng trắng thừa hai đầu — kinh điển khi dữ liệu đi qua Excel."""
    return f"  {value} "


def blankish(_value=None) -> str:
    """
    Ô trống theo kiểu người nhập, không phải null.

    Đây là chi tiết quan trọng: `""`, `"-"`, `"n.a."` và `null` đều nghĩa là
    "không có", nhưng chỉ `null` là code xử lý được ngay. Ba cái kia đòi hiểu
    ngữ cảnh.
    """
    return RNG.choice(["", "-", "n.a.", "k.A.", "  "])


# ─────────────────────────────────────────────────────────────────────────────
# Văn bản tự do thay cho trường có cấu trúc
# ─────────────────────────────────────────────────────────────────────────────

GERMAN_SYMPTOM = {
    "Flange edge burr above limit after milling":
        "Grat an Flanschkante > Grenzwert n. Fraesen, Schicht C",
    "Coolant leak at sealing surface reported by customer":
        "Kunde meldet Kuehlmittelaustritt Dichtflaeche - Reklamation",
    "Shaft outer diameter below lower tolerance after turning":
        "Wellen-AD unter unterem Grenzmass nach Drehen (Serie)",
    "Coating peel found at customer incoming inspection":
        "Lackabplatzung b. WE-Pruefung Kunde festgestellt",
    "Loose end cap bolts found at final audit":
        "Schrauben Enddeckel lose - Feststellung Endaudit",
    "Sensor mounts detaching in customer assembly":
        "Sensorhalter loesen sich in Kundenmontage",
    "Chatter marks on rotor shaft ground diameter":
        "Rattermarken auf geschliffenem Durchmesser Rotorwelle",
    "Fittings bottoming out in customer assembly":
        "Verschraubung setzt auf - Gewinde zu kurz (Kunde)",
    "Cracks at retainer flange radius after forming":
        "Risse am Flanschradius nach Umformen, Los komplett",
    "Bore misalignment reported at customer assembly":
        "Bohrungslage ausserhalb Toleranz - Kundenmeldung",
    "Valve body pocket depth varying unit to unit":
        "Taschentiefe Ventilkoerper schwankt Teil zu Teil",
    "Gloss level rejected at customer goods receipt":
        "Glanzgrad WE-Sperre beim Kunden",
}


def prose_measurement(row: dict) -> str:
    """
    Nhét số đo vào một câu văn thay vì để ở cột riêng.
    Đây là kiểu ghi chép rất hay gặp trong QM notification thật.
    """
    ch = row["characteristic"]
    meas = de_number(row["measured_value"])
    spec = de_number(row["spec_value"])
    return RNG.choice([
        f"{ch}: gemessen {meas}, Sollwert {spec}",
        f"{ch} = {meas} (Vorgabe {spec}) - iO/niO: niO",
        f"Messung {ch} ergab {meas}; lt. Zeichnung {spec}",
    ])


ACTION_TYPE_FREETEXT = {
    "Containment": ["Sofortmassnahme", "SM", "Eindaemmung", ""],
    "Corrective": ["Korrekturmassnahme", "KM", "Abstellmassnahme", ""],
    "Preventive": ["Vorbeugemassnahme", "VM", "vorbeugend", ""],
}


# ─────────────────────────────────────────────────────────────────────────────
# Kịch bản làm bẩn
# ─────────────────────────────────────────────────────────────────────────────

def degrade(case: dict) -> dict:
    """
    Trả về bản bẩn của một case sạch.

    Mỗi case bị làm bẩn theo một tổ hợp khác nhau — dữ liệu thật không hỏng đồng
    đều, và một bộ test mà mọi mẫu hỏng giống hệt nhau thì chỉ kiểm tra được đúng
    một đường đi.
    """
    c = copy.deepcopy(case)
    nid = c["notification_id"]
    # Đổi tiền tố để hai bản cùng tồn tại trong DB mà không đụng khoá.
    c["notification_id"] = nid.replace("8D-1", "8D-9", 1)

    # Chọn hồ sơ làm bẩn theo chữ số cuối — tất định, và trải đều các kiểu hỏng.
    profile = int(nid[-1]) % 4
    h = c["header"]

    # ── 1. Symptom thành văn bản tự do tiếng Đức viết tắt ──
    h["symptom_short_text"] = GERMAN_SYMPTOM.get(
        h["symptom_short_text"], h["symptom_short_text"])

    # ── 2. Ngày ở định dạng địa phương, KHÔNG đồng nhất giữa các trường ──
    h["found_date"] = messy_date(h["found_date"], profile % 3)
    if h.get("completion_date"):
        h["completion_date"] = messy_date(h["completion_date"], (profile + 1) % 3)

    # ── 3. Số lượng thành ước lượng ──
    h["quantity_extent"] = re.sub(
        r"^([\d,]+) units affected$",
        lambda m: RNG.choice([f"ca. {m.group(1)} Stk.", f"{m.group(1)} St", f"~{m.group(1)} Teile"]),
        h["quantity_extent"],
    )

    # ── 4. team_size lệch số dòng thật ──
    # Trường này người nhập gõ tay, gần như không bao giờ khớp.
    if profile in (0, 2):
        h["team_size"] = blankish()
    else:
        h["team_size"] = len(c["team_assignments"]) + RNG.choice([-1, 1])

    # ── 5. ID dính khoảng trắng / sai hoa thường ──
    c["material"]["material_id"] = pad_id(c["material"]["material_id"])
    if profile == 1:
        c["work_center"]["work_center_id"] = c["work_center"]["work_center_id"].lower()

    # ── 6. Số đo: một dòng thành văn xuôi, spec đôi khi không có số ──
    insp = c["inspections"]
    if insp:
        insp[0] = {
            "characteristic": insp[0]["characteristic"],
            "measured_value": prose_measurement(insp[0]),
            "spec_value": blankish(),
        }
    if len(insp) > 1 and profile in (0, 3):
        insp[1]["measured_value"] = de_number(insp[1]["measured_value"])
        insp[1]["spec_value"] = "lt. Zeichnung"   # 'theo bản vẽ' — không có số
    if profile == 2 and insp:
        insp.append(copy.deepcopy(insp[0]))       # dòng trùng do nhập hai lần

    # ── 7. Ishikawa: chỉ điều tra vài nhánh ──
    # Đây là khác biệt lớn nhất so với dữ liệu sạch. Thực tế kỹ sư chỉ ghi lại
    # nhánh nào họ thực sự đi kiểm tra; ba đến bốn nhánh còn lại đơn giản là
    # không tồn tại trong hệ thống.
    ish = c["causes_ishikawa"]
    root = next(r for r in ish if r["is_root_cause"] == "Y")
    others = [r for r in ish if r is not root]
    RNG.shuffle(others)
    keep = 1 if profile == 3 else 2
    c["causes_ishikawa"] = [root, *others[:keep]]

    # ── Cờ nguyên nhân gốc ──
    # Ba kịch bản, phân theo profile để tất định chứ không ngẫu nhiên:
    #   profile 1 → ghi bằng ký hiệu khác 'Y' ('x', 'ja') — mapper phải hiểu
    #   profile 3 → KHÔNG ai đánh dấu gì cả — mapper không được bịa ra một cái
    #   còn lại   → giữ 'Y' như chuẩn
    #
    # Trường hợp profile 3 mới là thú vị nhất: kỹ sư điều tra xong nhưng quên
    # kết luận. Chẩn đoán mù vẫn chạy được vì nó vốn dĩ không nhìn cờ này — chỉ
    # là không còn gì để đối chiếu, nên AI trở thành người duy nhất đưa ra kết
    # luận thay vì người phản biện.
    if profile == 1:
        for r in c["causes_ishikawa"]:
            r["is_root_cause"] = RNG.choice(["x", "ja"]) if r["is_root_cause"] == "Y" else blankish()
    elif profile == 3:
        for r in c["causes_ishikawa"]:
            r["is_root_cause"] = blankish()

    # metric_value trộn dấu phẩy thập phân
    for r in c["causes_ishikawa"]:
        if r.get("metric_value"):
            r["metric_value"] = de_number(r["metric_value"])

    # ── 8. Is / Is-Not: phần lớn case thật không có ──
    if profile != 0:
        c["is_is_not"] = {
            "is_where_when_it_happens": blankish(),
            "is_not_where_when_it_doesnt": blankish(),
            "notes": blankish(),
        }

    # ── 9. 5-Why: rút ngắn hoặc bỏ hẳn ──
    # Ràng buộc 2..5 dòng của Golden Dataset là quy ước của bộ dữ liệu, không
    # phải quy luật của SAP. Nhiều case chỉ có một dòng ghi vội.
    fw = c["five_why_chain"]
    if profile == 0:
        c["five_why_chain"] = []
    elif profile == 1:
        c["five_why_chain"] = [{
            **fw[-1],
            "step_no": 1,
            "question": blankish(),
            "evidence_citation": blankish(),
        }]
    else:
        c["five_why_chain"] = [
            {**s, "evidence_citation": blankish() if i else s["evidence_citation"]}
            for i, s in enumerate(fw[:2])
        ]

    # ── 10. Action: loại hành động không được phân loại ──
    for a in c["actions"]:
        a["action_type"] = RNG.choice(ACTION_TYPE_FREETEXT[a["action_type"]])
        if profile == 2:
            a["status"] = RNG.choice(["", "offen", "erledigt", "in Arbeit"])

    # ── 11. Chi phí và FMEA hay thiếu ──
    if profile in (1, 2):
        c["cost_copq"] = None
    if profile in (0, 3):
        c["fmea_link"] = None

    # ── 12. Lessons learned thường bỏ trống ──
    if profile != 1:
        c["lessons_learned"] = {
            "what_worked": blankish(),
            "what_didnt": blankish(),
        }

    # ── 13. Team: chức danh viết tắt, thiếu vai trò ──
    for i, t in enumerate(c["team_assignments"]):
        if profile == 3 and i > 0:
            t["partner_role"] = blankish()
        t["function_title"] = t["function_title"].replace("Engineer", "Eng.")
    if profile == 0 and len(c["team_assignments"]) > 2:
        # Trưởng nhóm không được đánh dấu
        c["team_assignments"][0]["partner_role"] = blankish()

    # ── 14. Khách hàng: liên hệ dạng một dòng lộn xộn ──
    cr = c["customer_reference"]
    if c["header"]["origin"].startswith("Q1") and profile in (0, 2):
        cr["customer_plant_contact"] = cr["customer_plant_contact"].replace(" - ", ", ")
        cr["sla_response_due"] = messy_date(cr["sla_response_due"], 0)

    return c


def degrade_all(cases: list[dict]) -> list[dict]:
    return [degrade(c) for c in cases]
