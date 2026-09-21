"""
Định nghĩa các case mock cho 8D Copilot.

Mỗi case là dữ liệu THUẦN — không chứa metadata. `generate.py` sẽ lắp chúng vào
khung `meta` / `schema` / `relationships` / `integrity` lấy nguyên từ file gốc
của nhóm, nên cấu trúc output giống 1:1 với `case-8D-10048412.json`.

Ràng buộc phải giữ (validator sẽ kiểm, xem generate.py):
  - đúng 6 dòng ishikawa, đúng 1 dòng is_root_cause = 'Y'
  - five_why 2..5 dòng, step_no liên tục từ 1, dòng root cause có '(root cause)'
    trong question và khớp category của dòng ishikawa 'Y'
  - team 2..4 dòng, đúng 1 leader, team_size khớp số dòng
  - completion_date non-null CHỈ khi status thuộc {Completed, Closed}
  - case Closed/Completed phải đủ Containment + Corrective + Preventive
  - Q1 -> customer_reference có dữ liệu thật; Q3 -> chuỗi 'N/A - ...'
  - batches[batch_id].material_id khớp notifications.material_id
"""

ISHIKAWA_ORDER = ["Man", "Machine", "Method", "Material", "Measurement", "Environment"]


# ─────────────────────────────────────────────────────────────────────────────
# Case 2 — Q1 Customer Complaint · root cause MATERIAL · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048577 = {
    "notification_id": "8D-10048577",
    "material": {"material_id": "MAT-10318", "description": "Pump Housing P90"},
    "batch": {"batch_id": "B-50231"},
    "defect": {"defect_code": "DEF-0512", "defect_text": "Porosity in sealing surface"},
    "work_center": {"work_center_id": "WC-CAST-03", "description": "Aluminium Die Casting Line 3"},
    "header": {
        "symptom_short_text": "Coolant leak at sealing surface reported by customer",
        "team_size": 3,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-07-28",
        "found_date": "2026-07-02",
        "quantity_extent": "46 units affected",
    },
    "inspections": [
        {"characteristic": "Porosity area ratio", "measured_value": "3.8%", "spec_value": "max 1.0%"},
        {"characteristic": "Helium leak rate", "measured_value": "12 mbar*l/s", "spec_value": "max 5 mbar*l/s"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-1187, Shift A - casting operator, no deviation logged",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-CAST03-001, die temperature within band all shift",
         "metric_value": "681C avg", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-3308 Rev D - die casting parameter sheet, unchanged",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Ingot lot ING-77412 hydrogen content 0.38 ppm vs max 0.20 ppm - degassing certificate accepted without re-test",
         "metric_value": "0.38 ppm", "is_root_cause": "Y", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "GA-0091, last cal 2026-05-11, within interval",
         "metric_value": "2.8% (illustrative)", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "24.5C / 58% RH at 14:20 (illustrative)",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1,
         "question": "Why did the housing leak at the sealing surface?",
         "answer": "Porosity area ratio measured 3.8% vs max 1.0% spec - gas pores broke through the machined sealing face",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2,
         "question": "Why was porosity so high in this batch?",
         "answer": "Ingot lot ING-77412 carried 0.38 ppm hydrogen against a 0.20 ppm limit, so gas came out of solution during solidification",
         "evidence_citation": "Incoming certificate ING-77412"},
        {"step_no": 3,
         "question": "Why did the out-of-spec ingot reach the casting line? (root cause)",
         "answer": "Incoming inspection accepted the supplier degassing certificate without an independent hydrogen re-test, so the deviation was never detected",
         "evidence_citation": "Incoming inspection plan MAT-10318"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "P90 sealing face - WC-CAST-03 - castings poured from ingot lot ING-77412 between 2026-06-24 and 2026-06-26",
        "is_not_where_when_it_doesnt": "P70 / P110 variants - WC-CAST-01 - castings from ingot lots ING-77380 and ING-77455",
        "notes": "Defect tracks the ingot lot, not the machine or the shift",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment",
         "action_text": "Block remaining stock from batch B-50231 and 100% helium leak test all P90 housings before dispatch",
         "status": "Done"},
        {"line_no": 2, "action_type": "Containment",
         "action_text": "Notify customer plant Valencia and sort 46 units already delivered",
         "status": "Done"},
        {"line_no": 3, "action_type": "Corrective",
         "action_text": "Reject and return ingot lot ING-77412 to supplier; release replacement lot ING-77455 after hydrogen re-test",
         "status": "Verified"},
        {"line_no": 4, "action_type": "Preventive",
         "action_text": "Add mandatory hydrogen content re-test to the incoming inspection plan for all aluminium ingot lots, independent of supplier certificate",
         "status": "Verified in production"},
    ],
    "fmea_link": {"fmea_id": "FMEA-CAST03-07", "description": "Gas porosity from incoming ingot hydrogen content"},
    "cost_copq": 28900,
    "lessons_learned": {
        "what_worked": "Batch traceability tied every failed unit back to a single ingot lot within two days",
        "what_didnt": "Supplier certificates were trusted without verification - the control existed only on paper",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0442",
        "customer_plant_contact": "Ana Ruiz - Plant 2, Valencia",
        "sla_response_due": "2026-07-09",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100023", "partner_name": "Luis Moreno", "function_title": "Foundry Process Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100031", "partner_name": "Sara Klein", "function_title": "Supplier Quality Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 3 — Q3 Internal Defect · root cause METHOD · Closed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048603 = {
    "notification_id": "8D-10048603",
    "material": {"material_id": "MAT-10402", "description": "Drive Shaft S150"},
    "batch": {"batch_id": "B-51044"},
    "defect": {"defect_code": "DEF-0377", "defect_text": "Shaft diameter below lower tolerance"},
    "work_center": {"work_center_id": "WC-TURN-02", "description": "CNC Turning Cell 2"},
    "header": {
        "symptom_short_text": "Shaft outer diameter below lower tolerance after turning",
        "team_size": 4,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-07-10",
        "found_date": "2026-06-15",
        "quantity_extent": "212 units affected",
    },
    "inspections": [
        {"characteristic": "Outer diameter", "measured_value": "24.912mm", "spec_value": "24.950-25.000mm"},
        {"characteristic": "Surface roughness Ra", "measured_value": "1.9um", "spec_value": "max 1.6um"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-2914, Shift B - ran the released program as written",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-TURN02-004, spindle runout 4um, within the 10um limit",
         "metric_value": "4um", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-5120 Rev A - turning work instruction still carries the pre-2025 tool offset and was never revised after the fixture change in 2026-04",
         "metric_value": "offset delta 0.041mm", "is_root_cause": "Y", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Bar stock cert PASS, hardness 212 HB within band",
         "metric_value": "212 HB", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "GA-0058, last cal 2026-05-04, R&R 5.1%",
         "metric_value": "5.1%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "22.4C at 09:10 (illustrative)",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1,
         "question": "Why is the shaft outer diameter below the lower tolerance?",
         "answer": "Measured 24.912mm against a 24.950mm lower limit - the tool cut 0.041mm deeper than nominal",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2,
         "question": "Why did the tool cut deeper than nominal?",
         "answer": "The turning program applied the old tool offset, which no longer matches the fixture datum after the 2026-04 change",
         "evidence_citation": "NC program archive WC-TURN-02"},
        {"step_no": 3,
         "question": "Why was the old offset still in use?",
         "answer": "Work instruction DOC-5120 Rev A was never revised when the fixture changed, so the released program remained the pre-2025 version",
         "evidence_citation": "DMS revision history DOC-5120"},
        {"step_no": 4,
         "question": "Why did the fixture change not trigger a work instruction revision? (root cause)",
         "answer": "The engineering change process has no mandatory link from a fixture change to the affected work instructions, so the revision was never raised",
         "evidence_citation": "Routing PLPO change log WC-TURN-02"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "S150 outer diameter - WC-TURN-02 - all parts turned after the 2026-04 fixture change",
        "is_not_where_when_it_doesnt": "S120 / S180 variants - WC-TURN-01 and WC-TURN-04 - fixtures unchanged, offsets still valid",
        "notes": "Defect starts exactly at the fixture change date, not at a tool or batch change",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment",
         "action_text": "Quarantine batch B-51044 and 100% gauge the outer diameter of all S150 shafts in WIP and finished stock",
         "status": "Done"},
        {"line_no": 2, "action_type": "Corrective",
         "action_text": "Correct the tool offset in the WC-TURN-02 turning program and re-release DOC-5120 as Rev B",
         "status": "Verified"},
        {"line_no": 3, "action_type": "Corrective",
         "action_text": "Rework 212 affected shafts to drawing or scrap where the diameter is unrecoverable",
         "status": "Done"},
        {"line_no": 4, "action_type": "Preventive",
         "action_text": "Extend the engineering change checklist so any fixture change forces a review of every linked work instruction before release",
         "status": "Verified in production"},
    ],
    "fmea_link": {"fmea_id": "FMEA-TURN02-01", "description": "Tool offset mismatch after fixture change"},
    "cost_copq": 19400,
    "lessons_learned": {
        "what_worked": "Tying the defect start date to the fixture change date narrowed the search to one document in a single day",
        "what_didnt": "The change process treated fixtures and work instructions as unrelated, so a known change silently invalidated a released program",
    },
    "customer_reference": {
        "complaint_reference": "N/A - internal defect, no customer reference",
        "customer_plant_contact": "N/A",
        "sla_response_due": "N/A",
    },
    "team_assignments": [
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100012", "partner_name": "Minh Dinh", "function_title": "Production Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100045", "partner_name": "Ingo Braun", "function_title": "Manufacturing Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100052", "partner_name": "Petra Vogel", "function_title": "Document Control Officer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 4 — Q1 Customer Complaint · root cause MEASUREMENT · In Process
#
# Cố ý KHÔNG có action Preventive và KHÔNG có fmea_link. Case đang mở thì chưa
# bắt buộc đủ 3 loại action (ràng buộc ACTION-TYPE-COVERAGE chỉ áp cho case đã
# đóng). Đây là phép thử: AI phải nói thẳng D7 chưa có dữ liệu thay vì bịa ra
# một preventive action không tồn tại.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048651 = {
    "notification_id": "8D-10048651",
    "material": {"material_id": "MAT-10555", "description": "Housing Cover C80"},
    "batch": {"batch_id": "B-51890"},
    "defect": {"defect_code": "DEF-0601", "defect_text": "Coating layer peeling"},
    "work_center": {"work_center_id": "WC-COAT-05", "description": "Powder Coating Line 5"},
    "header": {
        "symptom_short_text": "Coating peel found at customer incoming inspection",
        "team_size": 2,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "In Process",
        "completion_date": None,
        "found_date": "2026-08-01",
        "quantity_extent": "74 units affected",
    },
    "inspections": [
        {"characteristic": "Coating thickness", "measured_value": "38um", "spec_value": "60-90um"},
        {"characteristic": "Cross-cut adhesion", "measured_value": "Class 3", "spec_value": "Class 0-1"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-3402, Shift A - line settings matched the released recipe",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-COAT05-003, gun voltage and powder flow logged within band",
         "metric_value": "62 kV avg", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-6044 Rev C - powder coating recipe, unchanged since 2025-11",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Powder lot PWD-2231 within shelf life, cert PASS",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Thickness gauge GA-0117 calibration expired 2026-05-30; re-calibration on 2026-08-04 confirmed a -22um reading drift, so under-coated parts were passing as in-spec",
         "metric_value": "-22um drift", "is_root_cause": "Y", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "26.1C / 61% RH at 11:05 (illustrative)",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1,
         "question": "Why did the coating peel at the customer?",
         "answer": "Coating thickness measured 38um against a 60-90um spec, giving cross-cut adhesion Class 3 instead of Class 0-1",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2,
         "question": "Why did under-coated parts pass in-house inspection?",
         "answer": "Thickness gauge GA-0117 read 22um high, so a 38um coat was recorded as 60um and accepted",
         "evidence_citation": "Re-calibration record GA-0117 dated 2026-08-04"},
        {"step_no": 3,
         "question": "Why was a drifting gauge still in service? (root cause)",
         "answer": "GA-0117 calibration expired on 2026-05-30 and no interlock stops an expired gauge from being used for release decisions",
         "evidence_citation": "Test equipment register GA-0117"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "C80 covers - WC-COAT-05 - parts released against gauge GA-0117 after 2026-05-30",
        "is_not_where_when_it_doesnt": "C60 covers - WC-COAT-02 - released against gauge GA-0103, calibration current",
        "notes": "Defect follows the gauge, not the powder lot or the line settings",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment",
         "action_text": "Remove GA-0117 from service and re-measure all C80 stock with calibrated gauge GA-0103",
         "status": "Done"},
        {"line_no": 2, "action_type": "Containment",
         "action_text": "Contain 74 units at the customer plant and arrange sorting on site",
         "status": "Planned"},
        {"line_no": 3, "action_type": "Corrective",
         "action_text": "Re-calibrate GA-0117 and re-inspect every C80 lot released since 2026-05-30",
         "status": "Planned"},
    ],
    "fmea_link": None,
    "cost_copq": 8600,
    "lessons_learned": {
        "what_worked": "Comparing the two coating lines isolated the gauge as the only difference within one shift",
        "what_didnt": "Nothing prevented an expired gauge from being used for release - the calibration due date was advisory only",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0511",
        "customer_plant_contact": "Tobias Lang - Plant 4, Ingolstadt",
        "sla_response_due": "2026-08-08",
    },
    "team_assignments": [
        {"partner_id": "BP-100014", "partner_name": "Thien Tu", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100067", "partner_name": "Marek Nowak", "function_title": "Surface Treatment Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


ALL_CASES = [CASE_10048577, CASE_10048603, CASE_10048651]
