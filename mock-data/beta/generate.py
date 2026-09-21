#!/usr/bin/env python3
"""
Sinh file Golden Dataset cho các case mock, giữ cấu trúc giống 1:1 file gốc.

Cách chạy:
    python mock-data/generate.py

Nguyên tắc: KHÔNG tự viết lại `meta` / `schema` / `relationships` / `integrity`.
Lấy nguyên xi từ `case-8D-10048412.json` của nhóm rồi chỉ thay `data` và
`nested_case_view`. Nhờ vậy mọi thay đổi schema ở file gốc tự động lan sang các
case sinh ra, không bao giờ lệch.

`data` và `nested_case_view` cũng được dựng từ CÙNG một định nghĩa case trong
cases.py, nên hai khối này không thể mâu thuẫn nhau.

Validator chạy trước khi ghi. Case vi phạm ràng buộc thì script fail, không ghi
ra file rác.
"""

import copy
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cases import ALL_CASES, ISHIKAWA_ORDER  # noqa: E402
from cases_extra import EXTRA_CASES  # noqa: E402

ALL_CASES = [*ALL_CASES, *EXTRA_CASES]

HERE = Path(__file__).parent
TEMPLATE = HERE / "case-8D-10048412.json"

CLOSED_STATUSES = {"Completed", "Closed"}
Q1 = "Q1 - Customer Complaint"
Q3 = "Q3 - Internal Defect"


# ─────────────────────────────────────────────────────────────────────────────
# Dựng khối `data` (quan hệ phẳng)
# ─────────────────────────────────────────────────────────────────────────────

def build_data(case: dict) -> dict:
    nid = case["notification_id"]

    def stamp(rows):
        """Gắn notification_id vào đầu mỗi dòng — đúng thứ tự cột như file gốc."""
        return [{"notification_id": nid, **row} for row in rows]

    fmea = case.get("fmea_link")

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
        "cost_copq": [{"notification_id": nid,
                       "cost_of_poor_quality_eur": case["cost_copq"]}],
        "lessons_learned": stamp([case["lessons_learned"]]),
        "is_is_not": stamp([case["is_is_not"]]),
        "five_why_chain": stamp(case["five_why_chain"]),
        "customer_reference": stamp([case["customer_reference"]]),
        "team_assignments": stamp(case["team_assignments"]),
        "spc_process_data": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Dựng khối `nested_case_view` — copy metadata (_entity/_join) từ template
# ─────────────────────────────────────────────────────────────────────────────

def build_nested(case: dict, template_nested: dict) -> dict:
    nid = case["notification_id"]
    out = copy.deepcopy(template_nested)

    root_cat = next(r["category"] for r in case["causes_ishikawa"]
                    if r["is_root_cause"] == "Y")
    is_q1 = case["header"]["origin"] == Q1

    out["notification_id"] = nid
    out["_primary_key"]["columns"]["notification_id"] = nid

    out["header"] = {"_entity": "notifications", **case["header"]}

    out["material"] = {**{k: v for k, v in out["material"].items() if k.startswith("_")},
                       **case["material"]}
    out["batch"] = {**{k: v for k, v in out["batch"].items() if k.startswith("_")},
                    "batch_id": case["batch"]["batch_id"],
                    "material_id": case["material"]["material_id"]}
    # _nested_join nằm sau material_id trong file gốc — giữ nguyên vị trí
    out["batch"]["_nested_join"] = template_nested["batch"]["_nested_join"]
    out["defect"] = {**{k: v for k, v in out["defect"].items() if k.startswith("_")},
                     **case["defect"]}
    out["work_center"] = {**{k: v for k, v in out["work_center"].items() if k.startswith("_")},
                          **case["work_center"]}

    out["inspections"]["rows"] = case["inspections"]

    out["causes_ishikawa"]["_cardinality"] = f"{len(case['causes_ishikawa'])} rows"
    out["causes_ishikawa"]["root_cause_category"] = root_cat
    out["causes_ishikawa"]["rows"] = case["causes_ishikawa"]

    out["five_why_chain"]["_cardinality"] = f"{len(case['five_why_chain'])} rows (allowed 2-5)"
    out["five_why_chain"]["rows"] = case["five_why_chain"]

    out["is_is_not"] = {**{k: v for k, v in out["is_is_not"].items() if k.startswith("_")},
                        **case["is_is_not"]}

    out["actions"]["rows"] = case["actions"]

    fmea = case.get("fmea_link")
    out["fmea_link"] = {**{k: v for k, v in out["fmea_link"].items() if k.startswith("_")}}
    if fmea:
        out["fmea_link"].update(fmea)
    else:
        # Dùng lại đúng quy ước `_applicable` mà file gốc đã dùng cho
        # customer_reference, thay vì đặt ra một khoá metadata mới.
        out["fmea_link"]["_applicable"] = False
        out["fmea_link"]["fmea_id"] = None
        out["fmea_link"]["description"] = None

    out["cost_copq"] = {**{k: v for k, v in out["cost_copq"].items() if k.startswith("_")},
                        "cost_of_poor_quality_eur": case["cost_copq"]}
    out["lessons_learned"] = {**{k: v for k, v in out["lessons_learned"].items() if k.startswith("_")},
                              **case["lessons_learned"]}

    out["customer_reference"] = {
        **{k: v for k, v in out["customer_reference"].items() if k.startswith("_")},
        **case["customer_reference"],
    }
    out["customer_reference"]["_applicable"] = is_q1

    out["team_assignments"]["_cardinality"] = f"{len(case['team_assignments'])} rows (allowed 2-4)"
    out["team_assignments"]["rows"] = case["team_assignments"]

    out["spc_process_data"]["rows"] = []
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Validator — 13 ràng buộc trong integrity.constraints
# ─────────────────────────────────────────────────────────────────────────────

def validate(doc: dict) -> list[str]:
    d = doc["data"]
    errs: list[str] = []
    note = d["notifications"][0]
    nid = note["notification_id"]
    origin = note["origin"]

    def err(cid, msg):
        errs.append(f"[{cid}] {nid}: {msg}")

    # PK-UNIQUE
    for entity, keys in (("materials", ["material_id"]), ("batches", ["batch_id"]),
                         ("defect_catalog", ["defect_code"]), ("work_centers", ["work_center_id"]),
                         ("notifications", ["notification_id"])):
        seen = [tuple(r[k] for k in keys) for r in d[entity]]
        if len(seen) != len(set(seen)):
            err("PK-UNIQUE", f"{entity} có khoá trùng")

    # FK-EXISTS
    if note["material_id"] not in {r["material_id"] for r in d["materials"]}:
        err("FK-EXISTS", "material_id không tồn tại trong materials")
    if note["batch_id"] not in {r["batch_id"] for r in d["batches"]}:
        err("FK-EXISTS", "batch_id không tồn tại trong batches")
    if note["defect_code"] not in {r["defect_code"] for r in d["defect_catalog"]}:
        err("FK-EXISTS", "defect_code không tồn tại trong defect_catalog")
    if note["work_center_id"] not in {r["work_center_id"] for r in d["work_centers"]}:
        err("FK-EXISTS", "work_center_id không tồn tại trong work_centers")

    # BATCH-MATERIAL-MATCH
    batch = next(r for r in d["batches"] if r["batch_id"] == note["batch_id"])
    if batch["material_id"] != note["material_id"]:
        err("BATCH-MATERIAL-MATCH", "batch.material_id lệch notifications.material_id")

    # ISHIKAWA-6-ROWS
    cats = [r["category"] for r in d["causes_ishikawa"]]
    if sorted(cats) != sorted(ISHIKAWA_ORDER):
        err("ISHIKAWA-6-ROWS", f"phải đúng 6 category, đang có {cats}")
    roots = [r for r in d["causes_ishikawa"] if r["is_root_cause"] == "Y"]
    if len(roots) != 1:
        err("ISHIKAWA-6-ROWS", f"phải đúng 1 dòng is_root_cause='Y', đang có {len(roots)}")

    # FIVE-WHY-RANGE
    fw = sorted(d["five_why_chain"], key=lambda r: r["step_no"])
    if not (2 <= len(fw) <= 5):
        err("FIVE-WHY-RANGE", f"số dòng five_why = {len(fw)}, phải trong 2..5")
    if [r["step_no"] for r in fw] != list(range(1, len(fw) + 1)):
        err("FIVE-WHY-RANGE", "step_no không liên tục từ 1")

    # ROOT-CAUSE-CONSISTENCY
    rc_steps = [r for r in fw if "(root cause)" in r["question"].lower()]
    if len(rc_steps) != 1:
        err("ROOT-CAUSE-CONSISTENCY",
            f"phải đúng 1 bước five_why chứa '(root cause)', đang có {len(rc_steps)}")

    # TEAM-*
    team = d["team_assignments"]
    if not (2 <= len(team) <= 4):
        err("TEAM-RANGE", f"team có {len(team)} dòng, phải trong 2..4")
    leaders = [r for r in team if r["partner_role"] == "8D Team Leader"]
    if len(leaders) != 1:
        err("TEAM-ONE-LEADER", f"phải đúng 1 leader, đang có {len(leaders)}")
    if isinstance(note.get("team_size"), int) and note["team_size"] != len(team):
        err("TEAM-SIZE-MATCH", f"team_size={note['team_size']} nhưng có {len(team)} dòng")

    # Q1-ONLY-CUSTOMER-FIELDS
    cref = d["customer_reference"][0]
    na = re.compile(r"^N/A\b")
    if origin == Q3:
        for f in ("complaint_reference", "customer_plant_contact", "sla_response_due"):
            if cref[f] is not None and not na.match(str(cref[f])):
                err("Q1-ONLY-CUSTOMER-FIELDS", f"case Q3 nhưng {f} có dữ liệu thật")
    elif origin == Q1:
        if na.match(str(cref["complaint_reference"])):
            err("Q1-ONLY-CUSTOMER-FIELDS", "case Q1 nhưng complaint_reference là 'N/A'")

    # ACTION-TYPE-COVERAGE
    types = {r["action_type"] for r in d["actions"]}
    if note["status"] in CLOSED_STATUSES:
        missing = {"Containment", "Corrective", "Preventive"} - types
        if missing:
            err("ACTION-TYPE-COVERAGE",
                f"case {note['status']} thiếu action type: {sorted(missing)}")

    # COMPLETION-DATE-STATUS
    if note["completion_date"] is not None and note["status"] not in CLOSED_STATUSES:
        err("COMPLETION-DATE-STATUS",
            f"completion_date non-null nhưng status = {note['status']}")
    if note["completion_date"] is None and note["status"] in CLOSED_STATUSES:
        err("COMPLETION-DATE-STATUS",
            f"status = {note['status']} nhưng completion_date null")

    # SPC-NOT-PER-CASE
    if d["spc_process_data"]:
        err("SPC-NOT-PER-CASE", "spc_process_data phải rỗng (placeholder)")

    return errs


# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    if not TEMPLATE.exists():
        print(f"Không tìm thấy template: {TEMPLATE}", file=sys.stderr)
        return 1

    template = json.loads(TEMPLATE.read_text(encoding="utf-8"))

    # Template gốc cũng phải pass validator — nếu không, validator của ta sai.
    print("Kiểm tra template gốc…")
    errs = validate(template)
    if errs:
        print("  ✗ TEMPLATE GỐC KHÔNG PASS — validator có vấn đề:", file=sys.stderr)
        for e in errs:
            print("    " + e, file=sys.stderr)
        return 1
    print("  ✓ case-8D-10048412 hợp lệ\n")

    failed = False
    for case in ALL_CASES:
        nid = case["notification_id"]
        doc = copy.deepcopy(template)
        doc["data"] = build_data(case)
        doc["nested_case_view"] = build_nested(case, template["nested_case_view"])
        doc["integrity"]["validation_result_for_this_file"] = {
            "case_count": 1,
            "origin": case["header"]["origin"],
            "all_constraints_checked": True,
            "violations": [],
        }
        doc["meta"] = copy.deepcopy(template["meta"])

        errs = validate(doc)
        if errs:
            failed = True
            print(f"  ✗ {nid} — {len(errs)} vi phạm:", file=sys.stderr)
            for e in errs:
                print("    " + e, file=sys.stderr)
            continue

        out = HERE / f"case-{nid}.json"
        out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")
        rc = doc["nested_case_view"]["causes_ishikawa"]["root_cause_category"]
        print(f"  ✓ {nid}  {case['header']['origin']:24}  root={rc:12} "
              f"status={case['header']['status']:11} {out.stat().st_size // 1024} KB")

    if failed:
        print("\nCó case không hợp lệ — không ghi file cho case đó.", file=sys.stderr)
        return 1

    print(f"\nXong. {len(ALL_CASES) + 1} case trong {HERE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
