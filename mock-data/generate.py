#!/usr/bin/env python3
"""
Sinh hai bộ dữ liệu từ CÙNG một nguồn sự thật.

    clean/   12 case chỉn chu — đúng chuẩn Golden Dataset của nhóm
    dirty/   12 case tương ứng, đã làm bẩn như dữ liệu SAP QM thật

Chạy:
    python mock-data/generate.py

── Vì sao hai bộ phải cùng nguồn ──
`dirty/` không phải dữ liệu khác; nó là CÙNG những case đó, chỉ được ghi lại một
cách lộn xộn hơn. Cùng chiếc dao mòn, cùng con số 0,32mm — lần này nằm trong một
câu tiếng Đức viết tắt thay vì một cột tên `measured_value`.

Nhờ vậy phép so sánh mới có ý nghĩa: chạy cả hai, kết luận nguyên nhân gốc của AI
phải trùng nhau. Lệch nhau nghĩa là AI không đọc nổi dữ liệu bẩn — và đó chính là
thứ cần biết.

── Ghép cặp ──
    clean/case-8D-10048412.json  ←→  dirty/case-8D-90048412.json
Tiền tố `8D-1` đổi thành `8D-9` để hai bản cùng nằm trong DB mà không đụng khoá.

── Khung metadata ──
`meta` / `schema` / `relationships` / `integrity` lấy NGUYÊN XI từ file gốc của
nhóm (`beta/case-8D-10048412.json`), không viết lại. Nhóm sửa schema thì chạy lại
script là cả 24 file tự cập nhật theo.
"""

import copy
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from cases_clean import ALL_CASES, ISHIKAWA_ORDER  # noqa: E402
from degrade import degrade                        # noqa: E402

TEMPLATE = HERE / "beta" / "case-8D-10048412.json"
CLEAN_DIR = HERE / "clean"
DIRTY_DIR = HERE / "dirty"

CLOSED_STATUSES = {"Completed", "Closed"}
Q1 = "Q1 - Customer Complaint"
Q3 = "Q3 - Internal Defect"


# ─────────────────────────────────────────────────────────────────────────────
# Đọc case gốc của nhóm ra cùng hình dạng với các case viết tay
# ─────────────────────────────────────────────────────────────────────────────

# Nhóm vật tư của case gốc.
#
# Mười một case viết tay khai `material_group` ngay trong `cases_clean.py`. Case
# gốc thì đọc từ `beta/case-8D-10048412.json`, mà file đó ĐÓNG BĂNG có chủ đích —
# không sửa được. Nên nhóm của nó khai ở đây.
#
# Thiếu dòng này thì tiêu chí "cùng họ vật tư: +1" chết lặng đúng ở case dùng để
# demo: không báo lỗi, chỉ đơn giản là không bao giờ ăn điểm.
TEMPLATE_MATERIAL_GROUP = "MG-HOUSING"   # MAT-10247 Bracket Housing X240


def case_from_template(doc: dict) -> dict:
    """
    Bóc `data` của file gốc thành dict case, để nó đi qua đúng đường ống như 11
    case viết tay. Không đặc cách cho file gốc — nó cũng cần một bản bẩn.
    """
    d = doc["data"]
    note = d["notifications"][0]
    header_keys = [
        "symptom_short_text", "team_size", "origin", "customer_facing_summary",
        "internal_facing_summary", "status", "completion_date", "found_date",
        "quantity_extent",
    ]

    def strip_nid(rows):
        return [{k: v for k, v in r.items() if k != "notification_id"} for r in rows]

    fmea = d["fmea_link"][0] if d["fmea_link"] else None

    return {
        "notification_id": note["notification_id"],
        "material": {"material_group": TEMPLATE_MATERIAL_GROUP, **d["materials"][0]},
        "batch": {"batch_id": d["batches"][0]["batch_id"]},
        "defect": d["defect_catalog"][0],
        "work_center": d["work_centers"][0],
        "header": {k: note[k] for k in header_keys},
        "inspections": strip_nid(d["inspections"]),
        "causes_ishikawa": strip_nid(d["causes_ishikawa"]),
        "five_why_chain": strip_nid(d["five_why_chain"]),
        "is_is_not": strip_nid(d["is_is_not"])[0],
        "actions": strip_nid(d["actions"]),
        "fmea_link": {k: v for k, v in fmea.items() if k != "notification_id"} if fmea else None,
        "cost_copq": d["cost_copq"][0]["cost_of_poor_quality_eur"],
        "lessons_learned": strip_nid(d["lessons_learned"])[0],
        "customer_reference": strip_nid(d["customer_reference"])[0],
        "team_assignments": strip_nid(d["team_assignments"]),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Dựng khối `data`
# ─────────────────────────────────────────────────────────────────────────────

def build_data(case: dict) -> dict:
    nid = case["notification_id"]

    def stamp(rows):
        return [{"notification_id": nid, **row} for row in rows]

    fmea = case.get("fmea_link")
    cost = case.get("cost_copq")

    return {
        "$comment": (
            f"Dữ liệu quan hệ phẳng — đúng 1 defect case ({case['header']['origin']}). "
            "Mỗi mảng là một sheet; join bằng notification_id."
        ),
        "materials": [case["material"]],
        "batches": [{"batch_id": case["batch"]["batch_id"],
                     "material_id": case["material"]["material_id"]}],
        "defect_catalog": [case["defect"]],
        "work_centers": [case["work_center"]],
        "notifications": [{
            "notification_id": nid,
            "material_id": case["material"]["material_id"],
            "batch_id": case["batch"]["batch_id"],
            "defect_code": case["defect"]["defect_code"],
            "work_center_id": case["work_center"]["work_center_id"],
            **case["header"],
        }],
        "inspections": stamp(case["inspections"]),
        "causes_ishikawa": stamp(case["causes_ishikawa"]),
        "actions": stamp(case["actions"]),
        "fmea_link": stamp([fmea]) if fmea else [],
        "cost_copq": ([{"notification_id": nid, "cost_of_poor_quality_eur": cost}]
                      if cost is not None else []),
        "lessons_learned": stamp([case["lessons_learned"]]),
        "is_is_not": stamp([case["is_is_not"]]),
        "five_why_chain": stamp(case["five_why_chain"]),
        "customer_reference": stamp([case["customer_reference"]]),
        "team_assignments": stamp(case["team_assignments"]),
        "spc_process_data": [],
    }


def build_nested(case: dict, template_nested: dict) -> dict:
    """Lắp `nested_case_view`, giữ nguyên metadata `_entity` / `_join` của file gốc."""
    nid = case["notification_id"]
    out = copy.deepcopy(template_nested)
    meta = lambda node: {k: v for k, v in node.items() if k.startswith("_")}  # noqa: E731

    root_row = next((r for r in case["causes_ishikawa"]
                     if str(r.get("is_root_cause", "")).strip().lower() in ("y", "x", "ja")), None)
    is_q1 = case["header"]["origin"] == Q1

    out["notification_id"] = nid
    out["_primary_key"]["columns"]["notification_id"] = nid
    out["header"] = {"_entity": "notifications", **case["header"]}
    out["material"] = {**meta(out["material"]), **case["material"]}
    out["batch"] = {**meta(out["batch"]),
                    "batch_id": case["batch"]["batch_id"],
                    "material_id": case["material"]["material_id"],
                    "_nested_join": template_nested["batch"]["_nested_join"]}
    out["defect"] = {**meta(out["defect"]), **case["defect"]}
    out["work_center"] = {**meta(out["work_center"]), **case["work_center"]}

    out["inspections"]["rows"] = case["inspections"]
    out["causes_ishikawa"]["_cardinality"] = f"{len(case['causes_ishikawa'])} rows"
    out["causes_ishikawa"]["root_cause_category"] = root_row["category"] if root_row else None
    out["causes_ishikawa"]["rows"] = case["causes_ishikawa"]
    out["five_why_chain"]["_cardinality"] = f"{len(case['five_why_chain'])} rows"
    out["five_why_chain"]["rows"] = case["five_why_chain"]
    out["is_is_not"] = {**meta(out["is_is_not"]), **case["is_is_not"]}
    out["actions"]["rows"] = case["actions"]

    fmea = case.get("fmea_link")
    out["fmea_link"] = {**meta(out["fmea_link"])}
    if fmea:
        out["fmea_link"].update(fmea)
    else:
        out["fmea_link"]["_applicable"] = False
        out["fmea_link"]["fmea_id"] = None
        out["fmea_link"]["description"] = None

    cost = case.get("cost_copq")
    out["cost_copq"] = {**meta(out["cost_copq"]), "cost_of_poor_quality_eur": cost}
    if cost is None:
        out["cost_copq"]["_applicable"] = False

    out["lessons_learned"] = {**meta(out["lessons_learned"]), **case["lessons_learned"]}
    out["customer_reference"] = {**meta(out["customer_reference"]), **case["customer_reference"]}
    out["customer_reference"]["_applicable"] = is_q1
    out["team_assignments"]["_cardinality"] = f"{len(case['team_assignments'])} rows"
    out["team_assignments"]["rows"] = case["team_assignments"]
    out["spc_process_data"]["rows"] = []
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Validator — chỉ áp cho bộ SẠCH
#
# Bộ bẩn CỐ Ý vi phạm phần lớn ràng buộc dưới đây. Đó là mục đích của nó, nên
# bắt nó tuân thủ sẽ triệt tiêu chính giá trị của bộ dữ liệu.
# ─────────────────────────────────────────────────────────────────────────────

def validate_clean(doc: dict) -> list[str]:
    d = doc["data"]
    errs: list[str] = []
    note = d["notifications"][0]
    nid = note["notification_id"]
    origin = note["origin"]
    err = lambda cid, msg: errs.append(f"[{cid}] {nid}: {msg}")  # noqa: E731

    for entity, keys in (("materials", ["material_id"]), ("batches", ["batch_id"]),
                         ("defect_catalog", ["defect_code"]), ("work_centers", ["work_center_id"]),
                         ("notifications", ["notification_id"])):
        seen = [tuple(r[k] for k in keys) for r in d[entity]]
        if len(seen) != len(set(seen)):
            err("PK-UNIQUE", f"{entity} có khoá trùng")

    for field, target, key in (("material_id", "materials", "material_id"),
                               ("batch_id", "batches", "batch_id"),
                               ("defect_code", "defect_catalog", "defect_code"),
                               ("work_center_id", "work_centers", "work_center_id")):
        if note[field] not in {r[key] for r in d[target]}:
            err("FK-EXISTS", f"{field} không tồn tại trong {target}")

    batch = next((r for r in d["batches"] if r["batch_id"] == note["batch_id"]), None)
    if batch and batch["material_id"] != note["material_id"]:
        err("BATCH-MATERIAL-MATCH", "batch.material_id lệch notifications.material_id")

    cats = [r["category"] for r in d["causes_ishikawa"]]
    if sorted(cats) != sorted(ISHIKAWA_ORDER):
        err("ISHIKAWA-6-ROWS", f"phải đúng 6 category, đang có {len(cats)}")
    roots = [r for r in d["causes_ishikawa"] if r["is_root_cause"] == "Y"]
    if len(roots) != 1:
        err("ISHIKAWA-6-ROWS", f"phải đúng 1 dòng is_root_cause='Y', đang có {len(roots)}")

    fw = sorted(d["five_why_chain"], key=lambda r: r["step_no"])
    if not (2 <= len(fw) <= 5):
        err("FIVE-WHY-RANGE", f"five_why có {len(fw)} dòng, phải trong 2..5")
    if [r["step_no"] for r in fw] != list(range(1, len(fw) + 1)):
        err("FIVE-WHY-RANGE", "step_no không liên tục từ 1")
    if len([r for r in fw if "(root cause)" in r["question"].lower()]) != 1:
        err("ROOT-CAUSE-CONSISTENCY", "cần đúng 1 bước five_why đánh dấu '(root cause)'")

    team = d["team_assignments"]
    if not (2 <= len(team) <= 4):
        err("TEAM-RANGE", f"team có {len(team)} dòng, phải trong 2..4")
    if len([r for r in team if r["partner_role"] == "8D Team Leader"]) != 1:
        err("TEAM-ONE-LEADER", "phải đúng 1 leader")
    if isinstance(note.get("team_size"), int) and note["team_size"] != len(team):
        err("TEAM-SIZE-MATCH", f"team_size={note['team_size']} nhưng có {len(team)} dòng")

    cref = d["customer_reference"][0]
    na = re.compile(r"^N/A\b")
    if origin == Q3:
        for f in ("complaint_reference", "customer_plant_contact", "sla_response_due"):
            if cref[f] is not None and not na.match(str(cref[f])):
                err("Q1-ONLY-CUSTOMER-FIELDS", f"case Q3 nhưng {f} có dữ liệu thật")
    elif origin == Q1 and na.match(str(cref["complaint_reference"])):
        err("Q1-ONLY-CUSTOMER-FIELDS", "case Q1 nhưng complaint_reference là 'N/A'")

    types = {r["action_type"] for r in d["actions"]}
    if note["status"] in CLOSED_STATUSES:
        missing = {"Containment", "Corrective", "Preventive"} - types
        if missing:
            err("ACTION-TYPE-COVERAGE", f"case {note['status']} thiếu: {sorted(missing)}")

    closed = note["status"] in CLOSED_STATUSES
    if note["completion_date"] is not None and not closed:
        err("COMPLETION-DATE-STATUS", f"completion_date có giá trị nhưng status={note['status']}")
    if note["completion_date"] is None and closed:
        err("COMPLETION-DATE-STATUS", f"status={note['status']} nhưng completion_date trống")

    return errs


def describe_dirt(clean: dict, dirty: dict) -> str:
    """Tóm tắt case bẩn hỏng ở đâu — để README và log nói được cụ thể."""
    marks = []
    if len(dirty["causes_ishikawa"]) < len(clean["causes_ishikawa"]):
        marks.append(f"ishikawa {len(dirty['causes_ishikawa'])}/6")
    if len(dirty["five_why_chain"]) != len(clean["five_why_chain"]):
        marks.append(f"5why {len(dirty['five_why_chain'])}/{len(clean['five_why_chain'])}")
    if not str(dirty["is_is_not"]["is_where_when_it_happens"]).strip(" -"):
        marks.append("no is/is-not")
    if dirty.get("cost_copq") is None:
        marks.append("no cost")
    if dirty.get("fmea_link") is None:
        marks.append("no fmea")
    if not any(str(a["action_type"]).strip() for a in dirty["actions"]):
        marks.append("actions untyped")
    return ", ".join(marks) or "nhẹ"


# ─────────────────────────────────────────────────────────────────────────────

def build_deep_structure(case: dict) -> dict:
    nid = case["notification_id"]
    h = case["header"]

    def camel_key(k: str) -> str:
        parts = k.split("_")
        return parts[0] + "".join(p.capitalize() for p in parts[1:])

    def convert_row(row: dict) -> dict:
        out = {}
        for k, v in row.items():
            if k == "notification_id":
                continue
            out[camel_key(k)] = v
        return out

    def convert_rows(rows: list) -> list:
        return [convert_row(r) for r in rows]

    fmea = case.get("fmea_link")
    cost = case.get("cost_copq")

    return {
        "notificationId": nid,
        "origin": h["origin"],
        "symptomShortText": h["symptom_short_text"],
        "status": h["status"],
        "foundDate": h.get("found_date"),
        "completionDate": h.get("completion_date"),
        "quantityExtent": h.get("quantity_extent"),
        "teamSize": h.get("team_size"),
        "material": {
            "materialId": case["material"]["material_id"],
            "description": case["material"]["description"],
            # Nhóm vật tư (MATKL) — tiêu chí "cùng họ vật tư: +1" khi tìm tiền lệ.
            "materialGroup": case["material"].get("material_group"),
        },
        "batch": {
            "batchId": case["batch"]["batch_id"],
            "materialId": case["material"]["material_id"]
        },
        "defect": {
            "defectCode": case["defect"]["defect_code"],
            "defectText": case["defect"]["defect_text"]
        },
        "workCenter": {
            "workCenterId": case["work_center"]["work_center_id"],
            "description": case["work_center"]["description"]
        },
        "inspections": convert_rows(case.get("inspections", [])),
        "causesIshikawa": convert_rows(case.get("causes_ishikawa", [])),
        "fiveWhyChain": convert_rows(case.get("five_why_chain", [])),
        "actions": convert_rows(case.get("actions", [])),
        "teamAssignments": convert_rows(case.get("team_assignments", [])),
        "fmeaLink": convert_row(fmea) if fmea else None,
        "costCopq": {"costOfPoorQualityEur": cost} if cost is not None else None,
        "lessonsLearned": convert_row(case.get("lessons_learned", {})) if case.get("lessons_learned") else None,
        "isIsNot": convert_row(case.get("is_is_not", {})) if case.get("is_is_not") else None,
        "customerReference": convert_row(case.get("customer_reference", {})) if case.get("customer_reference") else None
    }


def write_case(case: dict, template: dict, out_dir: Path) -> Path:
    doc = build_deep_structure(case)
    path = out_dir / f"case-{case['notification_id']}.json"
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main() -> int:
    if not TEMPLATE.exists():
        print(f"Không tìm thấy template: {TEMPLATE}", file=sys.stderr)
        return 1

    template = json.loads(TEMPLATE.read_text(encoding="utf-8"))
    cases = [case_from_template(template), *ALL_CASES]

    CLEAN_DIR.mkdir(exist_ok=True)
    DIRTY_DIR.mkdir(exist_ok=True)
    for old in [*CLEAN_DIR.glob("case-*.json"), *DIRTY_DIR.glob("case-*.json")]:
        old.unlink()

    print(f"── clean/ ── {len(cases)} case")
    failed = False
    for case in cases:
        doc_errs = validate_clean({"data": build_data(case)})
        if doc_errs:
            failed = True
            print(f"  ✗ {case['notification_id']}", file=sys.stderr)
            for e in doc_errs:
                print(f"      {e}", file=sys.stderr)
            continue
        write_case(case, template, CLEAN_DIR)
        root = next(r["category"] for r in case["causes_ishikawa"] if r["is_root_cause"] == "Y")
        print(f"  ✓ {case['notification_id']}  {case['header']['origin'][:2]}  "
              f"root={root:12} {case['header']['status']}")

    if failed:
        print("\nBộ sạch có case không hợp lệ — dừng.", file=sys.stderr)
        return 1

    print(f"\n── dirty/ ── {len(cases)} case (cố ý vi phạm ràng buộc)")
    for case in cases:
        d = degrade(case)
        write_case(d, template, DIRTY_DIR)
        print(f"  ✓ {d['notification_id']}  ←  {case['notification_id']}   {describe_dirt(case, d)}")

    print(f"\nXong. {len(cases)} cặp clean/dirty.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
