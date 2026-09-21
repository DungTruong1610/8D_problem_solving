"""
Định nghĩa 12 case SẠCH — nguồn duy nhất cho cả `clean/` lẫn `dirty/`.

Bản bẩn được sinh ra bằng cách áp `degrade.py` lên chính những case này, nên hai
bộ luôn mô tả CÙNG một sự thật. Đó là điều kiện để so sánh có ý nghĩa: nếu AI
đọc được dữ liệu bẩn, kết luận của nó trên hai bộ phải trùng nhau.

Ràng buộc phải giữ ở bản sạch (validator kiểm, xem generate.py):
  - đúng 6 dòng ishikawa, đúng 1 dòng is_root_cause = 'Y'
  - five_why 2..5 dòng, step_no liên tục từ 1, đúng 1 dòng có '(root cause)'
  - team 2..4 dòng, đúng 1 leader, team_size khớp số dòng
  - completion_date non-null CHỈ khi status thuộc {Completed, Closed}
  - case Closed/Completed phải đủ Containment + Corrective + Preventive
  - Q1 -> customer_reference có dữ liệu thật; Q3 -> chuỗi 'N/A - ...'
"""

ISHIKAWA_ORDER = ["Man", "Machine", "Method", "Material", "Measurement", "Environment"]


# ─────────────────────────────────────────────────────────────────────────────
# Case 2 — Q1 Customer Complaint · root cause MATERIAL · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048577 = {
    "notification_id": "8D-10048577",
    "material": {"material_id": "MAT-10318", "description": "Pump Housing P90",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-50231"},
    "defect": {"defect_code": "DEF-0512", "defect_text": "Porosity at sealing flange face"},
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
    "material": {"material_id": "MAT-10402", "description": "Drive Shaft S150",
                 "material_group": "MG-SHAFT"},
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
    "material": {"material_id": "MAT-10555", "description": "Housing Cover C80",
                 "material_group": "MG-HOUSING"},
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





# ─────────────────────────────────────────────────────────────────────────────
# Case 5 — Q3 · root MAN · Closed
# Thao tác viên bỏ bước siết lực theo quy trình.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048702 = {
    "notification_id": "8D-10048702",
    "material": {"material_id": "MAT-10611", "description": "Gearbox End Cap G45",
                 "material_group": "MG-GEARBOX"},
    "batch": {"batch_id": "B-52310"},
    "defect": {"defect_code": "DEF-0723", "defect_text": "Bolt torque below specification"},
    "work_center": {"work_center_id": "WC-ASSY-08", "description": "Gearbox Assembly Line 8"},
    "header": {
        "symptom_short_text": "Loose end cap bolts found at final audit",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-07-22",
        "found_date": "2026-06-28",
        "quantity_extent": "63 units affected",
    },
    "inspections": [
        {"characteristic": "Bolt seating torque", "measured_value": "18 Nm", "spec_value": "34-38 Nm"},
        {"characteristic": "End cap gap", "measured_value": "0.41mm", "spec_value": "max 0.10mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-4471, Shift B - torque wrench sign-off missing on 63 consecutive units; operator ran the final pass by hand after the wrench was sent for calibration",
         "metric_value": "63 units without sign-off", "is_root_cause": "Y", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-ASSY08-002 nutrunner self-test passed each shift start",
         "metric_value": "all passes", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-7702 Rev F - assembly instruction specifies 36 Nm and a mandatory wrench sign-off; text unchanged",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Bolt lot BLT-8890 tensile and thread gauge PASS",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Audit torque tester GA-0210, last cal 2026-06-02, R&R 6.0%",
         "metric_value": "6.0%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "21.8C / 45% RH, nominal",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why were the end cap bolts loose?",
         "answer": "Seating torque measured 18 Nm against a 34-38 Nm window, roughly half the required clamp load",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2, "question": "Why was the torque only half of specification?",
         "answer": "The final torque pass was done by hand instead of with the calibrated nutrunner, so no controlled torque was ever applied",
         "evidence_citation": "MES sign-off log WC-ASSY-08"},
        {"step_no": 3, "question": "Why was the pass done by hand? (root cause)",
         "answer": "The wrench went out for calibration and no replacement was staged; the operator continued production rather than stopping the line, and nothing in the process blocked it",
         "evidence_citation": "Test equipment register GA-0210 / shift handover note"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "G45 end caps - WC-ASSY-08 - Shift B units built while the torque wrench was away for calibration",
        "is_not_where_when_it_doesnt": "G45 built on Shift A and Shift C - WC-ASSY-11 - wrench available throughout",
        "notes": "Defect window matches the calibration absence exactly",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Recall and re-torque all 63 units from the affected Shift B window"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Stage a calibrated backup nutrunner at WC-ASSY-08 before any tool leaves for calibration"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Make the MES step refuse a unit sign-off unless a calibrated torque tool ID is scanned"},
    ],
    "fmea_link": {"fmea_id": "FMEA-ASSY08-04", "description": "Insufficient clamp load from uncontrolled torque"},
    "cost_copq": 9800,
    "lessons_learned": {
        "what_worked": "Sign-off gaps in the MES log pinpointed the exact production window within hours",
        "what_didnt": "The process relied on the operator stopping the line voluntarily; nothing enforced it",
    },
    "customer_reference": {
        "complaint_reference": "N/A - internal defect, no customer reference",
        "customer_plant_contact": "N/A",
        "sla_response_due": "N/A",
    },
    "team_assignments": [
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100088", "partner_name": "Rita Fischer", "function_title": "Assembly Supervisor",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100091", "partner_name": "Karl Wagner", "function_title": "Maintenance Planner",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 6 — Q1 · root ENVIRONMENT · Completed
# Độ ẩm vượt ngưỡng khi đóng rắn keo.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048745 = {
    "notification_id": "8D-10048745",
    "material": {"material_id": "MAT-10744", "description": "Sensor Mount Bracket S22",
                 "material_group": "MG-BRACKET"},
    "batch": {"batch_id": "B-52688"},
    "defect": {"defect_code": "DEF-0810", "defect_text": "Adhesive bond failure"},
    "work_center": {"work_center_id": "WC-BOND-02", "description": "Structural Bonding Cell 2"},
    "header": {
        "symptom_short_text": "Sensor mounts detaching in customer assembly",
        "team_size": 4,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-05",
        "found_date": "2026-07-14",
        "quantity_extent": "310 units affected",
    },
    "inspections": [
        {"characteristic": "Lap shear strength", "measured_value": "4.1 MPa", "spec_value": "min 12.0 MPa"},
        {"characteristic": "Bond line thickness", "measured_value": "0.22mm", "spec_value": "0.15-0.30mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-5120, Shift A - surface prep steps signed off complete",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-BOND02-001 dispenser volume within +/-2% of target all shift",
         "metric_value": "+1.3%", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-8815 Rev B - bonding procedure, cure profile unchanged since 2025-08",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Adhesive lot ADH-3391 within shelf life, viscosity and cert PASS",
         "metric_value": "cert PASS", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Pull tester GA-0355, last cal 2026-04-18, R&R 7.4%",
         "metric_value": "7.4%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Bonding cell relative humidity logged 78-84% RH across 2026-07-06 to 07-09 against a 45% RH maximum; the cell dehumidifier had tripped and was not restarted",
         "metric_value": "84% RH peak vs 45% max", "is_root_cause": "Y", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did the sensor mounts detach?",
         "answer": "Lap shear strength measured 4.1 MPa against a 12.0 MPa minimum, one third of the required bond strength",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2, "question": "Why was the bond so weak despite correct adhesive and geometry?",
         "answer": "Moisture on the bonding surfaces during cure inhibited cross-linking; cell humidity reached 84% RH against a 45% maximum",
         "evidence_citation": "Environmental log WC-BOND-02"},
        {"step_no": 3, "question": "Why was humidity allowed to run at 84% for four days?",
         "answer": "The cell dehumidifier tripped on 2026-07-06 and was never restarted",
         "evidence_citation": "Facility alarm log 2026-07-06"},
        {"step_no": 4, "question": "Why did nobody notice the dehumidifier had tripped? (root cause)",
         "answer": "The humidity alarm reported to a facilities dashboard that production does not monitor, and no interlock stops bonding when the cell is out of its environmental window",
         "evidence_citation": "Facility monitoring configuration WC-BOND-02"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "S22 brackets bonded in WC-BOND-02 between 2026-07-06 and 07-09",
        "is_not_where_when_it_doesnt": "S22 bonded before 07-06 or after 07-10 - WC-BOND-05 with a working dehumidifier",
        "notes": "Defect window matches the dehumidifier outage exactly, not the adhesive lot",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Block all S22 stock bonded in the outage window and pull-test a sample from every pallet"},
        {"line_no": 2, "action_type": "Containment", "status": "Done",
         "action_text": "Notify the customer and sort the 310 units already delivered"},
        {"line_no": 3, "action_type": "Corrective", "status": "Verified",
         "action_text": "Restart and service the WC-BOND-02 dehumidifier, then re-qualify the cell with a bonded test panel"},
        {"line_no": 4, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Route cell humidity alarms to the production andon and interlock the bonding station above 50% RH"},
    ],
    "fmea_link": {"fmea_id": "FMEA-BOND02-02", "description": "Reduced bond strength from humidity during cure"},
    "cost_copq": 41200,
    "lessons_learned": {
        "what_worked": "Cross-referencing the defect window against facility alarm logs isolated the cause in one afternoon",
        "what_didnt": "A process-critical environmental alarm was routed to a dashboard nobody in production watches",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0498",
        "customer_plant_contact": "Jonas Berg - Plant 7, Gothenburg",
        "sla_response_due": "2026-07-21",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100102", "partner_name": "Dario Conti", "function_title": "Bonding Process Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100115", "partner_name": "Eva Lindqvist", "function_title": "Facilities Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100012", "partner_name": "Minh Dinh", "function_title": "Production Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 7 — Q3 · root MACHINE · In Process
# Ổ trục rung vượt ngưỡng.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048788 = {
    "notification_id": "8D-10048788",
    "material": {"material_id": "MAT-10820", "description": "Rotor Shaft R60",
                 "material_group": "MG-SHAFT"},
    "batch": {"batch_id": "B-53001"},
    "defect": {"defect_code": "DEF-0902", "defect_text": "Chatter marks on ground surface"},
    "work_center": {"work_center_id": "WC-GRIND-04", "description": "Cylindrical Grinding Cell 4"},
    "header": {
        "symptom_short_text": "Chatter marks on rotor shaft ground diameter",
        "team_size": 2,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "In Process",
        "completion_date": None,
        "found_date": "2026-08-06",
        "quantity_extent": "88 units affected",
    },
    "inspections": [
        {"characteristic": "Surface roughness Ra", "measured_value": "2.8um", "spec_value": "max 0.8um"},
        {"characteristic": "Roundness", "measured_value": "0.014mm", "spec_value": "max 0.006mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-6033, Shift A - dressing cycle run at the released interval",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-GRIND04-001 spindle bearing vibration 7.9 mm/s RMS against a 2.8 mm/s alarm limit; trend rising since 2026-07-20",
         "metric_value": "7.9 mm/s vs 2.8 limit", "is_root_cause": "Y", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-9120 Rev C - grinding parameters and dressing interval unchanged",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Bar stock hardness 58 HRC within the 56-60 HRC band",
         "metric_value": "58 HRC", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Roughness tester GA-0402, last cal 2026-07-11, R&R 4.8%",
         "metric_value": "4.8%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "22.1C, coolant temperature 19.6C, both nominal",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why are there chatter marks on the ground diameter?",
         "answer": "Surface roughness measured 2.8um against a 0.8um maximum and roundness 0.014mm against 0.006mm, the signature of vibration during grinding",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2, "question": "Why was there vibration during grinding? (root cause)",
         "answer": "Spindle bearing vibration reached 7.9 mm/s RMS against a 2.8 mm/s alarm limit, indicating bearing degradation",
         "evidence_citation": "Condition monitoring trend EQ-GRIND04-001"},
        {"step_no": 3, "question": "Why did a rising vibration trend since 2026-07-20 not trigger intervention?",
         "answer": "Condition monitoring data is reviewed monthly rather than on threshold breach, so the alarm limit was crossed without anyone acting",
         "evidence_citation": "PM review schedule WC-GRIND-04"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "R60 shafts ground on WC-GRIND-04 from 2026-08-01 onward",
        "is_not_where_when_it_doesnt": "R60 ground on WC-GRIND-01 - same wheel spec, same bar stock lot",
        "notes": "Defect follows the machine, not the material or the wheel",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Stop WC-GRIND-04, quarantine batch B-53001 and route R60 grinding to WC-GRIND-01"},
        {"line_no": 2, "action_type": "Corrective", "status": "Planned",
         "action_text": "Replace the WC-GRIND-04 spindle bearing set and re-qualify the machine with a capability run"},
    ],
    "fmea_link": None,
    "cost_copq": 15600,
    "lessons_learned": {
        "what_worked": "Comparing two grinding cells running the same job isolated the machine within one shift",
        "what_didnt": "Vibration data was trending toward the limit for two weeks with nobody watching it",
    },
    "customer_reference": {
        "complaint_reference": "N/A - internal defect, no customer reference",
        "customer_plant_contact": "N/A",
        "sla_response_due": "N/A",
    },
    "team_assignments": [
        {"partner_id": "BP-100012", "partner_name": "Minh Dinh", "function_title": "Production Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100091", "partner_name": "Karl Wagner", "function_title": "Maintenance Planner",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 8 — Q1 · root METHOD · Closed
# Bản vẽ ghi sai dung sai sau khi đổi thiết kế.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048811 = {
    "notification_id": "8D-10048811",
    "material": {"material_id": "MAT-10905", "description": "Manifold Block M12",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-53344"},
    "defect": {"defect_code": "DEF-1015", "defect_text": "Port thread depth insufficient"},
    "work_center": {"work_center_id": "WC-MILL-07", "description": "CNC Milling Line 7"},
    "header": {
        "symptom_short_text": "Fittings bottoming out in customer assembly",
        "team_size": 3,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-07-30",
        "found_date": "2026-06-19",
        "quantity_extent": "428 units affected",
    },
    "inspections": [
        {"characteristic": "Thread depth", "measured_value": "9.2mm", "spec_value": "min 14.0mm"},
        {"characteristic": "Thread pitch diameter", "measured_value": "10.86mm", "spec_value": "10.83-10.92mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-7201, Shift C - ran the released NC program without deviation",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-DRILL06-003 axis positioning verified 0.01mm, within the 0.03mm limit",
         "metric_value": "0.01mm", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-9930 Rev D - drawing still carries the pre-revision 9.5mm thread depth after the M12 port was changed to a deeper fitting in 2026-05; the NC program was generated from this drawing",
         "metric_value": "9.5mm drawn vs 14.0mm required", "is_root_cause": "Y", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Aluminium billet lot AL-4420 cert PASS",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Thread plug gauge GA-0511, last cal 2026-05-28, R&R 5.5%",
         "metric_value": "5.5%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "23.4C, nominal",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why do the fittings bottom out?",
         "answer": "Thread depth measured 9.2mm against a 14.0mm minimum, so the fitting reaches the bottom of the port before sealing",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2, "question": "Why was the thread only 9.2mm deep?",
         "answer": "The NC program drills to the 9.5mm depth carried on drawing DOC-9930 Rev D",
         "evidence_citation": "NC program archive WC-MILL-07"},
        {"step_no": 3, "question": "Why does the drawing still show 9.5mm after the port change?",
         "answer": "The 2026-05 design change to a deeper fitting updated the fitting callout but not the port depth dimension",
         "evidence_citation": "DMS revision history DOC-9930"},
        {"step_no": 4, "question": "Why did the design change ship with an inconsistent drawing? (root cause)",
         "answer": "The change review checked the fitting selection but had no step requiring the mating feature dimensions to be re-verified against it",
         "evidence_citation": "Engineering change record ECR-2026-0412"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "M12 manifolds drilled from DOC-9930 Rev D, produced after the 2026-05 design change",
        "is_not_where_when_it_doesnt": "M10 and M16 manifolds - same line, same operators, drawings unaffected by the change",
        "notes": "Defect is confined to the part touched by the design change",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Block all M12 stock and gauge thread depth on every unit at the customer and in transit"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Correct DOC-9930 to Rev E with the 14.0mm port depth and regenerate the NC program"},
        {"line_no": 3, "action_type": "Corrective", "status": "Done",
         "action_text": "Re-drill 428 affected manifolds to the corrected depth where stock allows, scrap the remainder"},
        {"line_no": 4, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Add a mandatory mating-feature dimension check to the engineering change review checklist"},
    ],
    "fmea_link": {"fmea_id": "FMEA-DRILL06-01", "description": "Feature dimension not updated after design change"},
    "cost_copq": 63400,
    "lessons_learned": {
        "what_worked": "Restricting the search to parts touched by the May design change narrowed 40 drawings down to one",
        "what_didnt": "The change review treated the fitting and the port it seats in as unrelated items",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0455",
        "customer_plant_contact": "Priya Nair - Plant 3, Pune",
        "sla_response_due": "2026-06-26",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100045", "partner_name": "Ingo Braun", "function_title": "Manufacturing Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100052", "partner_name": "Petra Vogel", "function_title": "Document Control Officer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 9 — Q3 · root MATERIAL · Completed
# Giao nhầm mác thép.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048834 = {
    "notification_id": "8D-10048834",
    "material": {"material_id": "MAT-11002", "description": "Spring Retainer SR8",
                 "material_group": "MG-SPRING"},
    "batch": {"batch_id": "B-53700"},
    "defect": {"defect_code": "DEF-1120", "defect_text": "Retainer cracking during forming"},
    "work_center": {"work_center_id": "WC-PRESS-09", "description": "Progressive Press Line 9"},
    "header": {
        "symptom_short_text": "Cracks at retainer flange radius after forming",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-07-18",
        "found_date": "2026-07-01",
        "quantity_extent": "1,240 units affected",
    },
    "inspections": [
        {"characteristic": "Material hardness", "measured_value": "214 HV", "spec_value": "max 160 HV"},
        {"characteristic": "Elongation at break", "measured_value": "11%", "spec_value": "min 22%"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-8140, Shift A - press setup verified against the setup sheet",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-PRESS09-001 tonnage and shut height logged within tolerance",
         "metric_value": "within band", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-10450 Rev A - forming sequence and radii unchanged since qualification",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Coil lot COIL-6612 delivered as DC04 but hardness 214 HV and elongation 11% match DC01 full-hard; supplier shipped the wrong grade against the same part number",
         "metric_value": "214 HV vs 160 HV max", "is_root_cause": "Y", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Hardness tester GA-0620, last cal 2026-06-09, R&R 3.9%",
         "metric_value": "3.9%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "22.7C / 41% RH, nominal",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why do the retainers crack at the flange radius?",
         "answer": "Elongation measured 11% against a 22% minimum, so the material cannot survive the forming strain",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2, "question": "Why is elongation half of specification?",
         "answer": "Coil lot COIL-6612 has hardness 214 HV against a 160 HV maximum, consistent with a full-hard grade rather than the specified DC04",
         "evidence_citation": "Incoming certificate COIL-6612"},
        {"step_no": 3, "question": "Why did a wrong-grade coil enter production? (root cause)",
         "answer": "Incoming inspection for this part number checks dimensions and surface only; there is no mechanical property check to catch a grade substitution",
         "evidence_citation": "Incoming inspection plan MAT-11002"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "SR8 retainers formed from coil lot COIL-6612",
        "is_not_where_when_it_doesnt": "SR8 from coil lots COIL-6588 and COIL-6640 - same press, same die, same operators",
        "notes": "Defect tracks the coil lot exclusively",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Quarantine all SR8 from COIL-6612 and hardness-test every remaining coil in the store"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Return coil lot COIL-6612 to the supplier and raise a supplier corrective action request"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Add hardness and elongation checks to the incoming inspection plan for all formed-steel part numbers"},
    ],
    "fmea_link": {"fmea_id": "FMEA-PRESS09-03", "description": "Cracking from incorrect material grade"},
    "cost_copq": 22300,
    "lessons_learned": {
        "what_worked": "Coil-level traceability tied all 1,240 cracked parts to a single delivery within a day",
        "what_didnt": "Incoming inspection could not distinguish two grades that look identical and share a part number",
    },
    "customer_reference": {
        "complaint_reference": "N/A - internal defect, no customer reference",
        "customer_plant_contact": "N/A",
        "sla_response_due": "N/A",
    },
    "team_assignments": [
        {"partner_id": "BP-100031", "partner_name": "Sara Klein", "function_title": "Supplier Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100014", "partner_name": "Thien Tu", "function_title": "Quality Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100133", "partner_name": "Ola Nyberg", "function_title": "Press Shop Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 10 — Q1 · root MEASUREMENT · In Process
# Chương trình CMM chọn sai datum.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048857 = {
    "notification_id": "8D-10048857",
    "material": {"material_id": "MAT-11130", "description": "Bearing Cap BC14",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-54012"},
    "defect": {"defect_code": "DEF-1233", "defect_text": "Bore position out of true position"},
    "work_center": {"work_center_id": "WC-MILL-11", "description": "CNC Milling Line 11"},
    "header": {
        "symptom_short_text": "Bore misalignment reported at customer assembly",
        "team_size": 3,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "In Process",
        "completion_date": None,
        "found_date": "2026-08-08",
        "quantity_extent": "156 units affected",
    },
    "inspections": [
        {"characteristic": "Bore true position", "measured_value": "0.19mm", "spec_value": "max 0.08mm"},
        {"characteristic": "Bore diameter", "measured_value": "42.012mm", "spec_value": "42.000-42.025mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-9022, Shift B - loaded parts per the fixture instruction",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-MILL11-002 ballbar test 0.012mm circularity, within the 0.02mm limit",
         "metric_value": "0.012mm", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-11260 Rev B - machining sequence and fixture unchanged",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Casting lot CST-7701 dimensional and hardness cert PASS",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "CMM program CMM-BC14-03 was rebuilt on 2026-07-15 and references datum B on the as-cast face instead of the machined face called out on the drawing; every part since then measured in-tolerance against the wrong datum",
         "metric_value": "datum offset 0.11mm", "is_root_cause": "Y", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "20.4C in the metrology room, within the 20 +/-1C requirement",
         "metric_value": "20.4C", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why is the bore out of true position at the customer?",
         "answer": "True position measured 0.19mm against a 0.08mm maximum when checked against the drawing datum",
         "evidence_citation": "Customer incoming inspection report"},
        {"step_no": 2, "question": "Why did these parts pass our own inspection?",
         "answer": "CMM program CMM-BC14-03 measures from the as-cast face rather than the machined datum B, understating true position by roughly 0.11mm",
         "evidence_citation": "CMM program revision log 2026-07-15"},
        {"step_no": 3, "question": "Why was a CMM program with the wrong datum released? (root cause)",
         "answer": "The program was rebuilt and put into service without a first-article correlation against the drawing datum scheme or a second-person review",
         "evidence_citation": "Metrology change record CMM-BC14-03",
         },
    ],
    "is_is_not": {
        "is_where_when_it_happens": "BC14 measured with CMM program CMM-BC14-03 after its 2026-07-15 rebuild",
        "is_not_where_when_it_doesnt": "BC14 measured before 07-15, and BC12 measured with its own unmodified program on the same CMM",
        "notes": "Defect follows the measurement program, not the machine or the casting lot",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Freeze CMM-BC14-03 and re-measure all BC14 stock against the drawing datum on a manual setup"},
        {"line_no": 2, "action_type": "Containment", "status": "Planned",
         "action_text": "Sort the 156 units at the customer and replace any part outside true position"},
        {"line_no": 3, "action_type": "Corrective", "status": "Planned",
         "action_text": "Rebuild CMM-BC14-03 against datum B and correlate against a first article before release"},
    ],
    "fmea_link": None,
    "cost_copq": 18700,
    "lessons_learned": {
        "what_worked": "The customer report and our own records disagreeing pointed straight at the measurement system rather than the process",
        "what_didnt": "A measurement program could be rebuilt and released with nobody checking it against the drawing",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0521",
        "customer_plant_contact": "Hugo Martins - Plant 9, Porto",
        "sla_response_due": "2026-08-15",
    },
    "team_assignments": [
        {"partner_id": "BP-100014", "partner_name": "Thien Tu", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100147", "partner_name": "Lena Hoffmann", "function_title": "Metrology Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100045", "partner_name": "Ingo Braun", "function_title": "Manufacturing Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 11 — MẬP MỜ ⚠ · Q3 · kỹ sư ghi MAN · Completed
#
# _design_note: Kỹ sư quy cho thao tác viên ("nạp sai chương trình"). Nhưng dòng
# Machine mang một số đo VƯỢT NGƯỠNG rõ ràng — bộ đổi dao lệch 0.9mm so với giới
# hạn 0.2mm — trong khi dòng Man chỉ là mô tả định tính, không có số. Theo luật
# "ưu tiên nhánh có số liệu phá ngưỡng" trong prompt, AI nhiều khả năng chọn
# Machine và phải nêu được lý do.
#
# Đây là case đáng xem nhất: nó phân biệt "AI suy luận theo bằng chứng" với
# "AI chiều theo đáp án có sẵn".
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048880 = {
    "notification_id": "8D-10048880",
    "material": {"material_id": "MAT-10247", "description": "Bracket Housing X240",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-54390"},
    "defect": {"defect_code": "DEF-1340", "defect_text": "Pocket depth inconsistent across units"},
    "work_center": {"work_center_id": "WC-MILL-07", "description": "CNC Milling Line 7"},
    "header": {
        "symptom_short_text": "Bracket housing pocket depth varying unit to unit",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-02",
        "found_date": "2026-07-19",
        "quantity_extent": "97 units affected",
    },
    "inspections": [
        {"characteristic": "Pocket depth", "measured_value": "12.84mm", "spec_value": "12.95-13.05mm"},
        {"characteristic": "Pocket depth spread", "measured_value": "0.62mm", "spec_value": "max 0.10mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-9310, Shift C - suspected of loading the previous revision of the NC program at shift start; no MES record of a program change was found",
         "metric_value": None, "is_root_cause": "Y", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-MILL14-001 automatic tool changer repeatability measured 0.9mm against a 0.2mm specification; drift confirmed on three separate test cycles",
         "metric_value": "0.9mm vs 0.2mm max", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-11890 Rev C - milling sequence unchanged, single released revision in the system",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Casting lot CST-8120 dimensional cert PASS",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Depth gauge GA-0730, last cal 2026-06-30, R&R 4.1%",
         "metric_value": "4.1%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "22.9C, nominal",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why does pocket depth vary across units?",
         "answer": "Depth measured 12.84mm against a 12.95-13.05mm window with a 0.62mm spread against a 0.10mm maximum",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2, "question": "Why was the depth wrong and inconsistent? (root cause)",
         "answer": "The operator is believed to have loaded a superseded NC program at shift start",
         "evidence_citation": "Shift handover note WC-MILL-07"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "X240 pockets milled on WC-MILL-07 across all three shifts from 2026-07-17",
        "is_not_where_when_it_doesnt": "X240 milled on WC-MILL-09 - same program revision, same castings, same operators rotating through",
        "notes": "Defect appears on every shift at WC-MILL-07, not only on Shift C",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Quarantine batch B-54390 and gauge pocket depth on 100% of X240 stock"},
        {"line_no": 2, "action_type": "Corrective", "status": "Done",
         "action_text": "Retrain Shift C operators on NC program selection and re-issue the setup sheet"},
        {"line_no": 3, "action_type": "Preventive", "status": "Planned",
         "action_text": "Lock NC program selection to the released revision at the machine controller"},
    ],
    "fmea_link": {"fmea_id": "FMEA-MILL14-02", "description": "Incorrect program revision loaded at setup"},
    "cost_copq": 11400,
    "lessons_learned": {
        "what_worked": "The defect was contained within two days of detection",
        "what_didnt": "The investigation closed on the operator explanation before the tool changer data was reviewed",
    },
    "customer_reference": {
        "complaint_reference": "N/A - internal defect, no customer reference",
        "customer_plant_contact": "N/A",
        "sla_response_due": "N/A",
    },
    "team_assignments": [
        {"partner_id": "BP-100088", "partner_name": "Rita Fischer", "function_title": "Assembly Supervisor",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100012", "partner_name": "Minh Dinh", "function_title": "Production Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100091", "partner_name": "Karl Wagner", "function_title": "Maintenance Planner",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 12 — MẬP MỜ ⚠ · Q1 · kỹ sư ghi METHOD · In Process
#
# _design_note: Kỹ sư quy cho quy trình sơn ("thời gian flash-off quá ngắn").
# Nhưng dòng Measurement cho thấy hệ đo có R&R 31% — trên ngưỡng 30% là mức
# "không chấp nhận được" theo MSA — nghĩa là chính con số dùng để kết luận cũng
# không đáng tin. Is/Is-Not lại cho thấy lỗi bám theo trạm đo chứ không theo
# buồng sơn.
#
# Đây là kiểu sai lầm rất người: kết luận dựa trên số đo mà không kiểm chứng hệ
# đo trước.

# ─────────────────────────────────────────────────────────────────────────────
# Case 13 — Q3 Internal Defect · root cause MACHINE · Closed
#
# CỐ Ý không trùng bất kỳ khoá nào với 8D-10048412: khác work center, khác vật
# tư, khác nhóm vật tư, khác mã lỗi, và mô tả lỗi không dùng chung một từ nào.
# Chấm theo luật ra đúng 0 điểm.
#
# Nhưng nội dung thì cùng một kiểu hỏng: dao mòn quá tuổi để lại kim loại thừa
# trên mép, phát hiện muộn vì chỉ kiểm ở công đoạn cuối. Đây là phép thử cho
# tiêu chí ngữ nghĩa — nếu nó không kéo được case này lên thì vector search
# không đem lại gì.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048420 = {
    "notification_id": "8D-10048420",
    "material": {"material_id": "MAT-11500", "description": "Sprocket Hub H22",
                 "material_group": "MG-DRIVE"},
    "batch": {"batch_id": "B-49688"},
    "defect": {"defect_code": "DEF-1610", "defect_text": "Raised metal ridge at bore mouth"},
    "work_center": {"work_center_id": "WC-BROACH-01", "description": "Broaching Line 1"},
    "header": {
        "symptom_short_text": "Assembly fitters cut their hands on hub bores",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-07-19",
        "found_date": "2026-06-28",
        "quantity_extent": "74 units affected",
    },
    "inspections": [
        {"characteristic": "Ridge height at bore mouth", "measured_value": "0.28mm", "spec_value": "max 0.05mm"},
        {"characteristic": "Bore mouth radius", "measured_value": "0.02mm", "spec_value": "0.20-0.40mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-3301, Shift A - ran the standard cycle, no deviation logged",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-BROACH01-002, broach tool ran 41,200 strokes against a 30,000 stroke replacement limit; cutting edges rounded and pushed material instead of shearing it",
         "metric_value": "41,200 of 30,000 strokes", "is_root_cause": "Y", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-7740 Rev C - broaching instruction current, cycle parameters unchanged",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Forging cert PASS, hardness 198 HB within band",
         "metric_value": "198 HB", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "PG-0142, last cal 2026-05-22, R&R 6.8%",
         "metric_value": "6.8%", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "21.8C at 07:40 (illustrative)",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1,
         "question": "Why is there a raised metal ridge at the bore mouth?",
         "answer": "Ridge measured 0.28mm against a 0.05mm maximum - the broach pushed material up instead of shearing it off",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2,
         "question": "Why did the broach push material instead of shearing it?",
         "answer": "Its cutting edges were rounded from wear after 41,200 strokes against a 30,000 stroke replacement limit",
         "evidence_citation": "Equipment maintenance log EQ-BROACH01-002"},
        {"step_no": 3,
         "question": "Why was a worn broach still in the machine? (root cause)",
         "answer": "Broach life is tracked on a paper tally at the machine and nobody owns it, so the replacement point passed unnoticed",
         "evidence_citation": "PM plan EQ-BROACH01-002"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "H22 hub bores - WC-BROACH-01 - parts broached after the tool passed 30,000 strokes on 2026-06-21",
        "is_not_where_when_it_doesnt": "H18 hubs on WC-BROACH-02 - same part family, tool replaced on schedule",
        "notes": "Defect starts at the stroke count overrun, not at a batch or shift change",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment",
         "action_text": "Quarantine batch B-49688 and inspect the bore mouth of all H22 hubs in WIP and finished stock",
         "status": "Done"},
        {"line_no": 2, "action_type": "Corrective",
         "action_text": "Replace the worn broach on EQ-BROACH01-002 and deburr the 74 affected hubs",
         "status": "Verified"},
        {"line_no": 3, "action_type": "Preventive",
         "action_text": "Move broach stroke counting into the PM system with an automatic work order at 90% of tool life, so replacement no longer depends on a paper tally",
         "status": "Verified in production"},
    ],
    "fmea_link": {"fmea_id": "FMEA-BROACH01-02", "description": "Broach tool wear"},
    "cost_copq": 8600,
    "lessons_learned": {
        "what_worked": "Stroke count from the PM log pinned the start date within one shift",
        "what_didnt": "Tool life was tracked on paper at the machine, so nobody saw the limit go by",
    },
    "customer_reference": {
        "complaint_reference": "N/A - internal defect, no customer reference",
        "customer_plant_contact": "N/A",
        "sla_response_due": "N/A",
    },
    "team_assignments": [
        {"partner_id": "BP-100014", "partner_name": "Karl Wagner", "function_title": "Maintenance Planner",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100012", "partner_name": "Minh Dinh", "function_title": "Production Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100061", "partner_name": "Anh Pham", "function_title": "Tooling Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
CASE_10048903 = {
    "notification_id": "8D-10048903",
    "material": {"material_id": "MAT-11388", "description": "Trim Panel T18",
                 "material_group": "MG-TRIM"},
    "batch": {"batch_id": "B-54720"},
    "defect": {"defect_code": "DEF-1455", "defect_text": "Paint gloss out of specification"},
    "work_center": {"work_center_id": "WC-PAINT-03", "description": "Topcoat Booth 3"},
    "header": {
        "symptom_short_text": "Gloss level rejected at customer goods receipt",
        "team_size": 4,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "In Process",
        "completion_date": None,
        "found_date": "2026-08-04",
        "quantity_extent": "204 units affected",
    },
    "inspections": [
        {"characteristic": "Gloss 60 degree", "measured_value": "71 GU", "spec_value": "82-90 GU"},
        {"characteristic": "Film build", "measured_value": "41um", "spec_value": "35-45um"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-9755, Shift A - booth parameters set per the released recipe",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-PAINT03-004 bell speed and flow logged within band all shift",
         "metric_value": "within band", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-12440 Rev E - flash-off time shortened from 90s to 60s in the 2026-06 cycle-time project",
         "metric_value": "60s vs previous 90s", "is_root_cause": "Y", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Paint lot PNT-5540 viscosity and solids within spec, cert PASS",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Gloss meter GA-0844 gauge R&R measured 31% of tolerance at the last MSA study on 2026-07-28, above the 30% acceptance threshold; the study was filed but the meter stayed in service",
         "metric_value": "R&R 31% vs 30% max", "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Booth 23.1C / 62% RH, within the 20-25C and 55-70% RH window",
         "metric_value": "23.1C / 62% RH", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why was gloss rejected at the customer?",
         "answer": "Gloss measured 71 GU against an 82-90 GU window",
         "evidence_citation": "Customer goods receipt report"},
        {"step_no": 2, "question": "Why was gloss low despite correct film build and paint? (root cause)",
         "answer": "Flash-off time was reduced from 90s to 60s in the June cycle-time project, leaving solvent in the film at cure",
         "evidence_citation": "DOC-12440 Rev E change record"},
        {"step_no": 3, "question": "Why did the change reach production without a gloss impact assessment?",
         "answer": "The cycle-time project treated flash-off as a throughput parameter rather than a quality-critical one",
         "evidence_citation": "Project record CT-2026-07"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "T18 panels measured on gloss meter GA-0844 at the Booth 3 inspection station",
        "is_not_where_when_it_doesnt": "T18 panels from the same booth and same shift re-measured on GA-0851 at the lab, which read 84-87 GU",
        "notes": "The lab and the line disagree on the same panels",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Hold all T18 stock and re-measure a sample on the laboratory gloss meter"},
        {"line_no": 2, "action_type": "Containment", "status": "Planned",
         "action_text": "Sort the 204 units at the customer against the drawing gloss requirement"},
        {"line_no": 3, "action_type": "Corrective", "status": "Planned",
         "action_text": "Restore the flash-off time to 90s in DOC-12440 and re-qualify the booth"},
    ],
    "fmea_link": None,
    "cost_copq": 26900,
    "lessons_learned": {
        "what_worked": "Holding the stock quickly limited further shipments",
        "what_didnt": "The line and the laboratory reported different gloss on the same panels and the disagreement was not resolved before assigning a cause",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0533",
        "customer_plant_contact": "Sofia Marino - Plant 5, Turin",
        "sla_response_due": "2026-08-11",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100067", "partner_name": "Marek Nowak", "function_title": "Surface Treatment Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100147", "partner_name": "Lena Hoffmann", "function_title": "Metrology Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 14 — Q3 Internal Defect · root cause MACHINE · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049010 = {
    "notification_id": "8D-10049010",
    "material": {"material_id": "MAT-10247", "description": "Bracket Housing X240",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-50341"},
    "defect": {"defect_code": "DEF-0104", "defect_text": "Chatter marks and surface waviness on milled flange"},
    "work_center": {"work_center_id": "WC-MILL-07", "description": "CNC 5-Axis Milling Center 7"},
    "header": {
        "symptom_short_text": "Surface roughness Ra 2.8um exceeding max 0.8um spec on flange face due to chatter",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-12",
        "found_date": "2026-08-01",
        "quantity_extent": "85 units affected",
    },
    "inspections": [
        {"characteristic": "Surface roughness Ra", "measured_value": "2.8um", "spec_value": "max 0.8um"},
        {"characteristic": "Drawbar retention force", "measured_value": "6.2 kN", "spec_value": "10.5 - 12.0 kN"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-4421, Shift B - operator performed tool change per SOP; toolholder cleaned before loading",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-MILL07-001 spindle drawbar disc spring stack had 4 broken Belleville washers, reducing clamping force from 11.2 kN to 6.2 kN and causing tool micro-slippage under milling load",
         "metric_value": "6.2 kN vs 11.0 kN nominal", "is_root_cause": "Y", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-8812 Rev C - milling cutting feed and spindle speed within validated machining parameters",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Cast aluminium alloy AlSi10Mg batch B-50341 hardness 82 HBW, within 75-90 HBW spec",
         "metric_value": "82 HBW", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Profilometer GA-0219 calibrated on 2026-07-15, stylus radius 2um verified",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Ambient shop floor temperature 22.4C, vibration sensor on foundation reading <0.5 mm/s",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why was the flange surface roughness out of specification?",
         "answer": "Excessive chatter vibration occurred between the end mill and the workpiece during finishing pass",
         "evidence_citation": "Inspection lot QALS/QAMR"},
        {"step_no": 2, "question": "Why did excessive tool chatter vibration occur during milling?",
         "answer": "The toolholder suffered dynamic micro-deflection in the spindle taper under cutting forces",
         "evidence_citation": "Vibration frequency spectrum PM log"},
        {"step_no": 3, "question": "Why did the spindle allow toolholder micro-deflection? (root cause)",
         "answer": "Spindle drawbar retention force dropped to 6.2 kN due to fatigue fracture of 4 Belleville disc springs in the internal clamping pack",
         "evidence_citation": "Spindle maintenance teardown report EQ-MILL07-001"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Bracket Housing X240 flange face on WC-MILL-07 using 63mm face mill on 2026-08-01",
        "is_not_where_when_it_doesnt": "Other parts machined on WC-MILL-05 and WC-MILL-06 with healthy drawbar force >11 kN",
        "notes": "Defect tracks machine spindle clamping force degradation, not part geometry or cutting tool batch",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "100% surface roughness inspection on all 85 quarantined housings and sort out-of-spec units"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Replace complete Belleville disc spring pack and gripper fingers on WC-MILL-07 spindle; re-test retention force to 11.5 kN"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Introduce preventive drawbar force gauge check into 500-hour PM schedule across all CNC milling centers"},
    ],
    "fmea_link": {"fmea_id": "FMEA-MILL-04", "description": "Toolholder slippage and chatter due to drawbar clamping spring fatigue"},
    "cost_copq": 14200,
    "lessons_learned": {
        "what_worked": "Retention force gauge immediately confirmed drawbar spring failure without full spindle removal",
        "what_didnt": "Drawbar clamping force was previously checked only during annual major overhaul rather than periodic PM",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100088", "partner_name": "Klaus Richter", "function_title": "CNC Maintenance Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 15 — Q1 Customer Complaint · root cause MEASUREMENT · Closed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049020 = {
    "notification_id": "8D-10049020",
    "material": {"material_id": "MAT-10510", "description": "Bushing Sleeve B45",
                 "material_group": "MG-BUSHING"},
    "batch": {"batch_id": "B-50388"},
    "defect": {"defect_code": "DEF-0220", "defect_text": "Outer diameter taper out of tolerance on CNC lathe"},
    "work_center": {"work_center_id": "WC-LATHE-02", "description": "CNC Twin-Spindle Lathe 2"},
    "header": {
        "symptom_short_text": "Customer assembly line jam due to OD taper exceeding 0.015mm cylindrical tolerance",
        "team_size": 3,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-08-18",
        "found_date": "2026-07-29",
        "quantity_extent": "120 units affected",
    },
    "inspections": [
        {"characteristic": "Outer diameter taper", "measured_value": "0.028mm", "spec_value": "max 0.010mm"},
        {"characteristic": "Coolant temperature drift", "measured_value": "38.5C", "spec_value": "20.0 - 24.0C"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-3310, Shift A - lathe operator executed tool wear offset per daily log sheet",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-LATHE02-003 chiller unit thermostat stuck closed, allowing coolant temperature to climb from 22C to 38.5C during afternoon continuous run",
         "metric_value": "38.5C vs 22C setpoint", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-9104 Rev B - CNC in-process touch probing performed without thermal compensation offset algorithm",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Alloy steel 42CrMo4 raw bar batch B-50388 dimensional runout and hardness 280 HBW verified compliant",
         "metric_value": "280 HBW", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "CNC in-process optical touch probe GA-0450 calibrated at 20C; thermal expansion of stylus shank at 38.5C coolant caused false in-cycle offset calculation of +18um",
         "metric_value": "Delta +18um thermal error", "is_root_cause": "Y", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Shop floor temperature controlled at 23.0C +/- 1.5C",
         "metric_value": "23.0C", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did the bushing sleeve jam during customer automated press-fit?",
         "answer": "The sleeve OD carried a taper of 0.028mm over its 60mm length, exceeding the 0.010mm drawing limit",
         "evidence_citation": "Customer quality claim CC-2026-0611"},
        {"step_no": 2, "question": "Why was the OD turned with a taper on the CNC lathe?",
         "answer": "The in-process touch probe registered an incorrect baseline dimension and applied a false progressive tool compensation offset",
         "evidence_citation": "CNC controller macro offset log"},
        {"step_no": 3, "question": "Why did the in-process touch probe measure with an 18um error? (root cause)",
         "answer": "Coolant temperature rose to 38.5C due to a failed chiller thermostat, thermally expanding the probe stylus while the calibration algorithm assumed constant 20C",
         "evidence_citation": "Metrology lab thermal expansion test report TR-2026-91"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Bushing Sleeve B45 machined on WC-LATHE-02 during afternoon shifts between 13:00 and 17:00",
        "is_not_where_when_it_doesnt": "Morning shift parts on WC-LATHE-02 or parts machined on WC-LATHE-01 with functional chiller",
        "notes": "Thermal drift correlated directly with coolant sump temperature climb during prolonged run",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Quarantine 120 sleeves at customer plant and sort finished inventory with air-gage OD micrometer"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Replace faulty coolant chiller thermostat on WC-LATHE-02 and integrate thermal probe compensation macro in CNC program"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Install automated coolant temperature interlock to halt machining if coolant exceeds 25C across all CNC lathe cells"},
    ],
    "fmea_link": {"fmea_id": "FMEA-LATHE-02", "description": "Dimensional drift caused by coolant thermal expansion of measuring probes"},
    "cost_copq": 22400,
    "lessons_learned": {
        "what_worked": "Air-gage sorting quickly separated 18 bad sleeves from good stock at the customer dock",
        "what_didnt": "In-process probe macro lacked a temperature reference input to guard against coolant thermal buildup",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0611",
        "customer_plant_contact": "Jean Dupont - Plant Lyon, Assembly Line 4",
        "sla_response_due": "2026-08-05",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100147", "partner_name": "Lena Hoffmann", "function_title": "Metrology Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100031", "partner_name": "Sara Klein", "function_title": "Supplier Quality Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 16 — Q3 Internal Defect · root cause MACHINE · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049030 = {
    "notification_id": "8D-10049030",
    "material": {"material_id": "MAT-10620", "description": "Stamping Bracket SB-12",
                 "material_group": "MG-BRACKET"},
    "batch": {"batch_id": "B-50412"},
    "defect": {"defect_code": "DEF-0318", "defect_text": "Excessive burr and edge micro-cracks on stamped sheet"},
    "work_center": {"work_center_id": "WC-PRESS-04", "description": "250T Progressive Stamping Press 4"},
    "header": {
        "symptom_short_text": "Burr height 0.22mm exceeding max 0.08mm limit on progressive die station 4",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-14",
        "found_date": "2026-08-03",
        "quantity_extent": "340 units affected",
    },
    "inspections": [
        {"characteristic": "Burr height", "measured_value": "0.22mm", "spec_value": "max 0.08mm"},
        {"characteristic": "Punch-to-die cutting clearance", "measured_value": "0.28mm (uneven)", "spec_value": "0.15 +/- 0.02mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-5192, Shift C - die setter performed routine die install with torque wrench per checklist",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "Progressive die tool DIE-250-04 guide post bronze bushings worn with 0.12mm radial play, causing cutting punch lateral shift and uneven cutting clearance of 0.28mm on right flank",
         "metric_value": "0.12mm guide play vs 0.02mm max", "is_root_cause": "Y", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-7721 Rev A - press stroke speed 65 spm within approved process envelope",
         "metric_value": "65 spm", "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Cold-rolled sheet steel DC04 strip lot ST-8819 thickness 1.50mm and yield strength compliant",
         "metric_value": "1.50mm", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Optical optical micrometer GA-0311 R&R 14%, calibration valid",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Strip lubrication oil flow rate 12 ml/min evenly distributed",
         "metric_value": "12 ml/min", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did stamped brackets show excessive burr height?",
         "answer": "The blanking punch produced tearing instead of clean shearing along the right-hand contour",
         "evidence_citation": "Visual inspection and optical profile measurement"},
        {"step_no": 2, "question": "Why was the shearing action tearing the sheet metal?",
         "answer": "Cutting clearance on the right side opened to 0.28mm against a nominal 0.15mm design specification",
         "evidence_citation": "Feeler gage tool inspection record"},
        {"step_no": 3, "question": "Why did the punch-to-die cutting clearance shift out of alignment? (root cause)",
         "answer": "Guide post ball-bearing bronze bushings on DIE-250-04 exceeded 250,000 strokes without replacement, developing 0.12mm radial play",
         "evidence_citation": "Tool shop maintenance history DIE-250-04"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Stamping Bracket SB-12 station 4 blanking on WC-PRESS-04 after 240,000 cumulative strokes",
        "is_not_where_when_it_doesnt": "Brackets run on recently refurbished die DIE-250-02 with fresh guide bushings",
        "notes": "Burr concentrated exclusively on right-side contour where guide play caused punch offset",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Quarantine 340 stamped brackets and run secondary deburring on vibratory tumbling line"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Rebuild DIE-250-04 guide pillar assembly with hardened ball-guide bushings and re-align cutting inserts"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Implement automated stroke counter PM rule to replace die guide bushings at 150,000 stroke threshold in SAP PM"},
    ],
    "fmea_link": {"fmea_id": "FMEA-PRESS-08", "description": "Cutting edge burr due to progressive die guide bushing wear"},
    "cost_copq": 11800,
    "lessons_learned": {
        "what_worked": "Secondary vibratory deburring recovered 94% of parts without scrapping base material",
        "what_didnt": "Tooling PM relied on calendar months rather than actual press stroke count",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100088", "partner_name": "Klaus Richter", "function_title": "Tooling Maintenance Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 17 — Q1 Customer Complaint · root cause METHOD · Closed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049040 = {
    "notification_id": "8D-10049040",
    "material": {"material_id": "MAT-10730", "description": "Electronic Enclosure EE-50",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-50455"},
    "defect": {"defect_code": "DEF-0440", "defect_text": "Sink mark and internal void on cosmetic injection molded surface"},
    "work_center": {"work_center_id": "WC-MOLD-01", "description": "150T Injection Molding Machine 1"},
    "header": {
        "symptom_short_text": "Visible sink mark 0.35mm depth on top cosmetic cover rejected by customer inspection",
        "team_size": 3,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-08-20",
        "found_date": "2026-08-04",
        "quantity_extent": "210 units affected",
    },
    "inspections": [
        {"characteristic": "Sink mark depth", "measured_value": "0.35mm", "spec_value": "max 0.05mm"},
        {"characteristic": "Holding pressure duration", "measured_value": "2.5s", "spec_value": "5.0 - 6.0s"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-6201, Shift B - process technician loaded molding parameter program from USB backup",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-MOLD01-002 barrel temperature zones 1-4 and hydraulic pressure stability within +/-1.5%",
         "metric_value": "stable", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "Molding recipe REC-EE50-02 had holding pressure time set to 2.5s instead of validated 5.5s, switching to cooling before the 3.2mm boss gate solidified",
         "metric_value": "2.5s vs 5.5s validated", "is_root_cause": "Y", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Polycarbonate/ABS blend resin lot RES-3390 MFI 18 g/10min and moisture 0.015% verified within spec",
         "metric_value": "MFI 18", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Depth dial indicator GA-0190 calibrated and repeatability confirmed",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Mold chiller water temperature 45C +/- 2C on both core and cavity sides",
         "metric_value": "45C", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did the customer reject the electronic enclosure top covers?",
         "answer": "A noticeable 0.35mm sink mark shadow was visible directly opposite the internal mounting screw boss",
         "evidence_citation": "Customer defect notification CC-2026-0719"},
        {"step_no": 2, "question": "Why did plastic volumetric shrinkage form a sink mark at the boss?",
         "answer": "Molten polymer was sucked back from the thick boss wall section during cooling before gate freeze occurred",
         "evidence_citation": "Moldflow simulation verification report"},
        {"step_no": 3, "question": "Why was packing pressure released before gate freeze? (root cause)",
         "answer": "An unreleased trial parameter recipe with 2.5s holding time was loaded during mold changeover instead of the locked production recipe",
         "evidence_citation": "Injection machine recipe change audit trail REC-EE50"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Electronic Enclosure EE-50 molded on WC-MOLD-01 on 2026-08-04 after mold setup",
        "is_not_where_when_it_doesnt": "Batches produced prior to 2026-08-04 or running on WC-MOLD-02 with locked recipe card",
        "notes": "Sink mark strictly restricted to the thick boss region due to premature hold pressure release",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Sort 210 units at customer facility and hold 450 finished enclosures in warehouse for visual audit"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Restore validated holding pressure duration (5.5s @ 650 bar) and lock controller recipe with password"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Connect injection molding machines to central MES recipe server with checksum validation to block unapproved USB parameter loading"},
    ],
    "fmea_link": {"fmea_id": "FMEA-MOLD-06", "description": "Sink mark and cosmetic defect due to insufficient hold packing time"},
    "cost_copq": 19600,
    "lessons_learned": {
        "what_worked": "Locking recipe with central server checksum eliminated manual parameter tampering",
        "what_didnt": "Operators were able to load test USB recipes without supervisor sign-off",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0719",
        "customer_plant_contact": "Marcus Lindqvist - Plant Gothenburg",
        "sla_response_due": "2026-08-11",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100067", "partner_name": "Marek Nowak", "function_title": "Plastics Process Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 18 — Q3 Internal Defect · root cause MATERIAL · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049050 = {
    "notification_id": "8D-10049050",
    "material": {"material_id": "MAT-10840", "description": "Control Board PCBA-900",
                 "material_group": "MG-PCBA"},
    "batch": {"batch_id": "B-50490"},
    "defect": {"defect_code": "DEF-0580", "defect_text": "Solder bridging short circuit on fine-pitch QFN package"},
    "work_center": {"work_center_id": "WC-SMT-02", "description": "SMT Placement & Reflow Line 2"},
    "header": {
        "symptom_short_text": "Automated Optical Inspection (AOI) detected 18 solder bridges on 0.4mm pitch QFN pins",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-16",
        "found_date": "2026-08-05",
        "quantity_extent": "48 boards affected",
    },
    "inspections": [
        {"characteristic": "Solder paste volume", "measured_value": "165%", "spec_value": "80 - 120%"},
        {"characteristic": "Stencil nano-coating contact angle", "measured_value": "52 deg", "spec_value": "min 95 deg"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-8104, Shift A - printer operator loaded approved stencil ST-QFN-04 and verified paste thaw time",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "Solder paste printer EQ-SMT02-001 squeegee pressure 0.22 kg/cm and separation speed 0.5 mm/s within spec",
         "metric_value": "0.22 kg/cm", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-6610 Rev D - stencil wipe frequency set to every 3 prints with solvent-assisted vacuum wipe",
         "metric_value": "every 3 prints", "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Laser-cut stencil ST-QFN-04 fluoropolymer nano-coating degraded after 65,000 print cycles (limit 40,000), causing solder paste smear along aperture walls onto 0.4mm pads",
         "metric_value": "65,000 cycles vs 40,000 max", "is_root_cause": "Y", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "3D Solder Paste Inspection (SPI) sensor GA-0902 calibrated and height repeatability confirmed",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "SMT cleanroom temperature 22.8C / 48% RH, within 20-25C and 40-60% RH envelope",
         "metric_value": "22.8C / 48% RH", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did PCBA-900 fail post-reflow automated optical inspection?",
         "answer": "Adjacent pins on the 0.4mm pitch QFN microcontroller were shorted by solder bridges",
         "evidence_citation": "AOI defect log line 2"},
        {"step_no": 2, "question": "Why did solder bridge across the fine-pitch QFN pads?",
         "answer": "Excess solder paste volume (165%) was deposited with paste bleed across aperture borders during printing",
         "evidence_citation": "3D SPI volumetric mapping data"},
        {"step_no": 3, "question": "Why did solder paste bleed across stencil apertures? (root cause)",
         "answer": "The hydrophobic nano-coating on stencil ST-QFN-04 had worn off after 65,000 print cycles without scheduled replacement, allowing flux and paste adhesion to aperture undersides",
         "evidence_citation": "Tool tracking life record and contact angle measurement TR-2026-44"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "PCBA-900 fine-pitch QFN U12 on SMT Line 2 using stencil ST-QFN-04 on 2026-08-05",
        "is_not_where_when_it_doesnt": "Large-pitch components (SOIC, 0805) or boards printed on SMT Line 1 with new stencil",
        "notes": "Defect exclusively concentrated on fine-pitch 0.4mm footprint where aperture wall release is critical",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Rework 48 bridged boards using hot-air micro-soldering and 100% X-ray inspection"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Scrap worn stencil ST-QFN-04 and install new nano-coated laser stencil with verified 105 deg contact angle"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Integrate RFID stencil life tracker into solder printer to automatically lock out stencils exceeding 40,000 prints"},
    ],
    "fmea_link": {"fmea_id": "FMEA-SMT-03", "description": "Solder paste bridging due to stencil aperture nano-coating wear"},
    "cost_copq": 15400,
    "lessons_learned": {
        "what_worked": "SPI 3D volumetric threshold caught paste smear before boards entered reflow oven",
        "what_didnt": "Stencil usage counting relied on manual spreadsheet entry instead of automated machine lockout",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100023", "partner_name": "Luis Moreno", "function_title": "SMT Process Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 19 — Q3 Internal Defect · root cause MAN · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049060 = {
    "notification_id": "8D-10049060",
    "material": {"material_id": "MAT-10950", "description": "Pump Motor Assembly PMA-30",
                 "material_group": "MG-ASSEMBLY"},
    "batch": {"batch_id": "B-50522"},
    "defect": {"defect_code": "DEF-0630", "defect_text": "Stripped plastic thread boss during automated screwdriving"},
    "work_center": {"work_center_id": "WC-ASSY-05", "description": "Automated Sub-Assembly Station 5"},
    "header": {
        "symptom_short_text": "Thread stripping on M4 plastic boss detected by screwdriving angle-torque monitor",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-22",
        "found_date": "2026-08-07",
        "quantity_extent": "62 units affected",
    },
    "inspections": [
        {"characteristic": "Tightening torque", "measured_value": "3.2 Nm (over-torqued)", "spec_value": "1.8 +/- 0.2 Nm"},
        {"characteristic": "Thread engagement depth", "measured_value": "stripped", "spec_value": "min 6.0mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-7190, Shift B - changeover operator manually selected fastening Recipe B (metal housing 3.2 Nm) instead of Recipe A (thermoplastic boss 1.8 Nm) on HMI dropdown",
         "metric_value": "Recipe B selected vs A", "is_root_cause": "Y", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-SCREW05-001 electric spindle driver torque transducer calibrated accurately to +/-1.0%",
         "metric_value": "calibrated", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-5519 Rev B - work instruction lacked visual barcode confirmation requirement before starting screwdriving cycle",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Glass-filled PA66 motor bracket material batch B-50522 tensile strength and boss inner diameter compliant",
         "metric_value": "compliant", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Torque-angle curve analyzer GA-0711 triggered torque-over-angle NOK alarm immediately",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Assembly station clean and vibration-free",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did the motor assembly fail the final end-of-line vibration test?",
         "answer": "Fastener M4x16 was loose and spinning freely in the plastic housing boss",
         "evidence_citation": "End of line assembly test log"},
        {"step_no": 2, "question": "Why was the M4 screw stripped in the plastic boss?",
         "answer": "The automatic screwdriving spindle applied 3.2 Nm peak torque against a 1.8 Nm plastic stripping limit",
         "evidence_citation": "Screwdriver controller torque-angle log file"},
        {"step_no": 3, "question": "Why did the electric screwdriver apply 3.2 Nm torque? (root cause)",
         "answer": "The operator manually selected Recipe B on the HMI touchscreen during line changeover without barcode cross-verification",
         "evidence_citation": "HMI audit log event timestamp 2026-08-07 14:15"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "PMA-30 thermoplastic variants assembled on WC-ASSY-05 on 2026-08-07 afternoon shift",
        "is_not_where_when_it_doesnt": "PMA-30 metal housing variants or assemblies produced on morning shift",
        "notes": "Defect caused exclusively by manual HMI recipe mismatch on plastic variant line run",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "100% torque inspection on 62 assembled pump motors and replace stripped plastic housings"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Implement 2D barcode scanner interlock on screwdriver controller to select recipe automatically from part label"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Disable manual HMI program selection dropdown across all automated fastening stations in the plant"},
    ],
    "fmea_link": {"fmea_id": "FMEA-ASSY-07", "description": "Plastic thread stripping due to incorrect screwdriving torque program selection"},
    "cost_copq": 9400,
    "lessons_learned": {
        "what_worked": "Torque-over-angle trace immediately captured the stripped fasteners at station level",
        "what_didnt": "Manual dropdown menus on touchscreens created opportunity for operator selection error",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100023", "partner_name": "Luis Moreno", "function_title": "Assembly Process Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 20 — Q1 Customer Complaint · root cause ENVIRONMENT · Closed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049070 = {
    "notification_id": "8D-10049070",
    "material": {"material_id": "MAT-11060", "description": "Bezel Frame BF-10",
                 "material_group": "MG-FRAME"},
    "batch": {"batch_id": "B-50560"},
    "defect": {"defect_code": "DEF-0714", "defect_text": "Pitting corrosion and dark discoloration on anodized aluminum bezel"},
    "work_center": {"work_center_id": "WC-ANOD-01", "description": "Type II Sulfuric Anodizing Line 1"},
    "header": {
        "symptom_short_text": "Customer incoming inspection rejected 150 anodized frames due to surface pitting and color mottling",
        "team_size": 3,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-08-25",
        "found_date": "2026-08-08",
        "quantity_extent": "150 units affected",
    },
    "inspections": [
        {"characteristic": "Coating thickness", "measured_value": "14.2um", "spec_value": "12.0 - 18.0um"},
        {"characteristic": "DI rinse water conductivity", "measured_value": "34.5 uS/cm", "spec_value": "max 5.0 uS/cm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-2281, Shift A - anodizing line operator followed racking spacing and current ramp procedure",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-ANOD01-003 rectifier voltage and temperature bath chilling operated within standard envelope",
         "metric_value": "18.5V / 19.8C", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-4401 Rev E - black dye immersion time 8 min and nickel acetate sealing 20 min compliant",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Extruded aluminium 6063-T6 alloy certificate compliant, iron and copper content within limits",
         "metric_value": "Fe 0.18%", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Eddy-current thickness gauge GA-0610 calibrated on ISO reference foils",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Deionized (DI) post-anodize rinse water tank conductivity climbed to 34.5 uS/cm (limit 5.0 uS/cm) due to exhausted mixed-bed ion exchange resin, leaving chloride residue that pitted the unsealed oxide pores",
         "metric_value": "34.5 uS/cm vs 5.0 uS/cm max", "is_root_cause": "Y", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did the customer reject the anodized bezel frames?",
         "answer": "Micro-pitting and white bloom spotting appeared under cosmetic inspection lighting",
         "evidence_citation": "Customer defect notification CC-2026-0881"},
        {"step_no": 2, "question": "Why did micro-pitting develop on the anodized oxide layer?",
         "answer": "Chloride ions trapped inside unsealed anodic pores initiated localized galvanic micro-corrosion during hot sealing",
         "evidence_citation": "Scanning electron microscope (SEM/EDX) surface analysis"},
        {"step_no": 3, "question": "Why were chloride ions present in the sealing bath rinse? (root cause)",
         "answer": "The DI water purification resin bed reached exhaustion over the weekend and the inline conductivity sensor alarm was muted",
         "evidence_citation": "DI water plant maintenance log and conductivity alarm historian"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Bezel Frame BF-10 processed through WC-ANOD-01 rinse tank 3 on 2026-08-08 morning run",
        "is_not_where_when_it_doesnt": "Frames processed after resin tank replacement on 2026-08-09 reading 1.8 uS/cm",
        "notes": "Pitting failure directly tracked rinse tank conductivity spike above 30 uS/cm",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Quarantine 150 frames at customer dock and sort 320 finished frames in central stock"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Dump and recharge DI rinse tank 3; replace exhausted mixed-bed ion exchange resin cylinders"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Hardwire conductivity sensor high-limit alarm (>5.0 uS/cm) to line conveyor PLC to halt hoist transfer automatically"},
    ],
    "fmea_link": {"fmea_id": "FMEA-ANOD-05", "description": "Pitting corrosion in anodic oxide coating due to contaminated DI rinse water"},
    "cost_copq": 24800,
    "lessons_learned": {
        "what_worked": "SEM/EDX micro-analysis pinpointed chloride contamination within 4 hours",
        "what_didnt": "Alarm acknowledge button allowed line operators to continue running with contaminated water",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0881",
        "customer_plant_contact": "Oliver Braun - Plant Munich",
        "sla_response_due": "2026-08-15",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100067", "partner_name": "Marek Nowak", "function_title": "Surface Treatment Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100031", "partner_name": "Sara Klein", "function_title": "Chemical Process Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 21 — Q3 Internal Defect · root cause MACHINE · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049080 = {
    "notification_id": "8D-10049080",
    "material": {"material_id": "MAT-10402", "description": "Drive Shaft S150",
                 "material_group": "MG-SHAFT"},
    "batch": {"batch_id": "B-50604"},
    "defect": {"defect_code": "DEF-0822", "defect_text": "Insufficient case depth after induction hardening"},
    "work_center": {"work_center_id": "WC-HEAT-03", "description": "Induction Hardening Cell 3"},
    "header": {
        "symptom_short_text": "Effective induction case depth 1.1mm below minimum 1.8mm drawing specification",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-26",
        "found_date": "2026-08-10",
        "quantity_extent": "54 units affected",
    },
    "inspections": [
        {"characteristic": "Effective case depth (50 HRC)", "measured_value": "1.15mm", "spec_value": "1.80 - 2.40mm"},
        {"characteristic": "Induction coil cooling flow", "measured_value": "14 l/min", "spec_value": "28 - 32 l/min"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-1904, Shift C - heat treat operator verified coil alignment and scan speed per setup sheet",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "High-frequency induction coil EQ-HEAT03-001 internal cooling passage choked with calcium mineral scale, reducing flow to 14 l/min and causing thermal derating of generator power output by 16%",
         "metric_value": "14 l/min vs 30 l/min nominal", "is_root_cause": "Y", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-3390 Rev C - induction scanning speed 4.2 mm/s and quench polymer concentration 12% verified compliant",
         "metric_value": "4.2 mm/s", "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Forged alloy steel 42CrMo4 chemistry (C 0.41%, Cr 1.05%, Mo 0.22%) and grain size 7 compliant",
         "metric_value": "C 0.41%", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Microhardness tester GA-0512 optical indentation and calibration verified",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Quench polymer tank temperature maintained at 28C +/- 2C",
         "metric_value": "28C", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did the drive shaft batch fail destructive metallurgical inspection?",
         "answer": "Effective case depth to 50 HRC reached only 1.15mm against the 1.80mm minimum requirement",
         "evidence_citation": "Metallurgy lab cross-section hardness report ML-2026-104"},
        {"step_no": 2, "question": "Why was the heat-affected austenitizing zone too shallow?",
         "answer": "RF induction power delivered to the shaft surface dropped from 85 kW to 71 kW during the scanning stroke",
         "evidence_citation": "Induction generator power telemetry log"},
        {"step_no": 3, "question": "Why did generator power drop during scanning? (root cause)",
         "answer": "Severe calcium scale inside the induction copper coil reduced cooling flow by 50%, triggering automatic thermal power throttling in the generator inverter",
         "evidence_citation": "Maintenance coil descaling and water circuit inspection report"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Drive Shaft S150 induction hardened on WC-HEAT-03 on 2026-08-10",
        "is_not_where_when_it_doesnt": "Shafts hardened on WC-HEAT-01 with demineralized closed-loop cooling system",
        "notes": "Defect caused exclusively by coil cooling passage scaling on open-tower circuit",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Quarantine 54 drive shafts from batch B-50604 and perform 100% eddy current non-destructive case depth testing"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Acid flush and descale induction coil on WC-HEAT-03; restore cooling water flow to 31 l/min"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Convert induction cell cooling to closed-loop deionized water chiller circuit across all heat treat lines"},
    ],
    "fmea_link": {"fmea_id": "FMEA-HEAT-04", "description": "Shallow hardening depth due to induction coil cooling restriction and power throttling"},
    "cost_copq": 18200,
    "lessons_learned": {
        "what_worked": "Eddy current non-destructive testing sorted good parts without scrapping the full batch",
        "what_didnt": "Cooling water quality in heat treatment was connected to open tower with high mineral hardness",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100088", "partner_name": "Klaus Richter", "function_title": "Heat Treat Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 22 — Q1 Customer Complaint · root cause METHOD · Closed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049090 = {
    "notification_id": "8D-10049090",
    "material": {"material_id": "MAT-11170", "description": "Exhaust Flange EF-80",
                 "material_group": "MG-EXHAUST"},
    "batch": {"batch_id": "B-50640"},
    "defect": {"defect_code": "DEF-0910", "defect_text": "Internal porosity in robotic fiber laser welded lap joint"},
    "work_center": {"work_center_id": "WC-WELD-02", "description": "4kW Fiber Laser Welding Cell 2"},
    "header": {
        "symptom_short_text": "Exhaust flange weld seam failed helium leak test at customer Tier-1 exhaust plant",
        "team_size": 3,
        "origin": "Q1 - Customer Complaint",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Closed",
        "completion_date": "2026-08-27",
        "found_date": "2026-08-11",
        "quantity_extent": "92 units affected",
    },
    "inspections": [
        {"characteristic": "Helium leak rate", "measured_value": "8.4 mbar*l/s", "spec_value": "max 0.5 mbar*l/s"},
        {"characteristic": "Shielding gas nozzle angle", "measured_value": "28 deg", "spec_value": "12 - 16 deg"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-4109, Shift A - robot welding programmer taught seam coordinates per nominal CAD model",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-WELD02-001 4kW fiber laser power output 3.2 kW and beam focus BPP verified stable",
         "metric_value": "3.2 kW", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "Shielding gas delivery nozzle bracket bent to 28 deg inclination during robot teaching, creating Venturi turbulent air aspirating into the molten keyhole",
         "metric_value": "28 deg vs 15 deg design", "is_root_cause": "Y", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Stainless steel AISI 304 flange and tube chemical composition and surface oil-free condition verified",
         "metric_value": "clean", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Mass spectrometer helium leak detector GA-0988 calibration certified",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Welding booth cross-draft exhaust airflow 0.4 m/s compliant",
         "metric_value": "0.4 m/s", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did exhaust flange assemblies leak during customer exhaust system leak test?",
         "answer": "Helium gas passed through connected subsurface gas pore channels across the laser weld bead",
         "evidence_citation": "Customer quality claim CC-2026-0940"},
        {"step_no": 2, "question": "Why were continuous gas pores formed in the laser weld keyhole?",
         "answer": "Atmospheric oxygen and nitrogen were drawn into the molten pool, generating gas bubbles during rapid solidification",
         "evidence_citation": "Weld metallographic cross-section and gas chromatography"},
        {"step_no": 3, "question": "Why was the shielding gas envelope compromised during welding? (root cause)",
         "answer": "The Argon gas nozzle bracket was deflected to 28 deg after colliding with a fixture clamp during robot touch-up, inducing turbulent air vortexing",
         "evidence_citation": "Robot cell collision log and nozzle geometry inspection"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Exhaust Flange EF-80 welded on WC-WELD-02 robot arm 1 on 2026-08-11",
        "is_not_where_when_it_doesnt": "Flanges welded on WC-WELD-01 with rigid dowel-pinned nozzle bracket",
        "notes": "Porosity caused by bent nozzle angle after unrecorded fixture micro-collision",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Sort and 100% helium leak test 92 units at customer plant and quarantine 180 units in transit"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Replace flexible nozzle bracket with dowel-located rigid steel mounting block set to 15 deg"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Add optical nozzle alignment check to automated daily robot zeroing routine in cell PLC"},
    ],
    "fmea_link": {"fmea_id": "FMEA-WELD-05", "description": "Laser weld porosity due to shielding gas nozzle misalignment and air turbulence"},
    "cost_copq": 27500,
    "lessons_learned": {
        "what_worked": "Rigid dowel mounting prevented nozzle bracket angle shift even during tool servicing",
        "what_didnt": "Robot minor collision sensor did not force an optical re-alignment check",
    },
    "customer_reference": {
        "complaint_reference": "CC-2026-0940",
        "customer_plant_contact": "Anders Holm - Plant Gothenburg Exhaust Systems",
        "sla_response_due": "2026-08-18",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100023", "partner_name": "Luis Moreno", "function_title": "Welding Automation Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100031", "partner_name": "Sara Klein", "function_title": "Supplier Quality Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 23 — Q3 Internal Defect · root cause MATERIAL · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049100 = {
    "notification_id": "8D-10049100",
    "material": {"material_id": "MAT-10318", "description": "Pump Housing P90",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-50672"},
    "defect": {"defect_code": "DEF-1020", "defect_text": "Hydraulic pressure test leak due to O-ring seal extrusion"},
    "work_center": {"work_center_id": "WC-ASSY-08", "description": "Final Hydraulic Leak Test Line 8"},
    "header": {
        "symptom_short_text": "Pressure drop 1.4 bar detected at 6 bar hydraulic leak test station",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-28",
        "found_date": "2026-08-12",
        "quantity_extent": "38 units affected",
    },
    "inspections": [
        {"characteristic": "Hydraulic pressure decay", "measured_value": "1.4 bar / 30s", "spec_value": "max 0.1 bar / 30s"},
        {"characteristic": "O-ring Shore hardness", "measured_value": "54 Shore A", "spec_value": "70 +/- 5 Shore A"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-7712, Shift B - assembly technician installed O-rings using guided assembly mandrel per SOP",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "Automated leak test bench EQ-LEAK08-001 pressure transducers and pneumatic sealing plugs fully functional",
         "metric_value": "calibrated", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-2210 Rev D - groove dimensions (width 3.2mm, depth 2.3mm) and assembly sequence compliant",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "NBR rubber O-ring supplier lot OR-9912 received with incorrect Shore A hardness of 54 vs drawing specification of 70 +/- 5 Shore A; soft material extruded into clearance gap under 6 bar test pressure",
         "metric_value": "54 Shore A vs 70 required", "is_root_cause": "Y", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Durometer hardness gage GA-0222 calibrated per ISO 7619-1",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Hydraulic test oil ISO VG 46 temperature 24.1C compliant",
         "metric_value": "24.1C", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did the assembled pump housing leak during end-of-line testing?",
         "answer": "Hydraulic oil leaked past the main flange sealing interface at 6 bar test pressure",
         "evidence_citation": "Leak test station 8 data acquisition log"},
        {"step_no": 2, "question": "Why did the O-ring fail to maintain pressure seal?",
         "answer": "The O-ring cross-section suffered gap extrusion and nibbling along the outer mating flange edge",
         "evidence_citation": "Teardown visual analysis and microscope photos"},
        {"step_no": 3, "question": "Why did the O-ring extrude into the clearance gap? (root cause)",
         "answer": "Incoming O-ring batch OR-9912 was supplied with low-hardness 54 Shore A NBR compound instead of 70 Shore A due to supplier compounding error",
         "evidence_citation": "Incoming material re-test certificate and supplier 8D response"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "P90 housings assembled with O-ring batch OR-9912 on 2026-08-12",
        "is_not_where_when_it_doesnt": "Housings assembled with O-ring batch OR-9908 with verified 70 Shore A hardness",
        "notes": "Failure strictly limited to supplier rubber batch OR-9912 compounding error",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Purge all remaining O-ring stock from batch OR-9912 in warehouse and assembly line kitting bins"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Issue supplier corrective action request to rubber vendor and re-qualify replacement batch OR-9920"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Mandate sample Shore A Durometer hardness check on every incoming elastomer lot in SAP QM inspection plan"},
    ],
    "fmea_link": {"fmea_id": "FMEA-PUMP-03", "description": "Hydraulic seal leakage caused by out-of-spec elastomer hardness and gap extrusion"},
    "cost_copq": 12600,
    "lessons_learned": {
        "what_worked": "100% end-of-line pressure decay test prevented any defective pumps from reaching customer",
        "what_didnt": "Incoming inspection accepted supplier Certificate of Analysis without verifying Shore A hardness",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100031", "partner_name": "Sara Klein", "function_title": "Supplier Quality Engineer",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 24 — Q3 Internal Defect · root cause METHOD · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049110 = {
    "notification_id": "8D-10049110",
    "material": {"material_id": "MAT-11280", "description": "Guide Rail GR-200",
                 "material_group": "MG-LINEAR"},
    "batch": {"batch_id": "B-50710"},
    "defect": {"defect_code": "DEF-1140", "defect_text": "Grinding burn and micro-cracks on precision linear guideway"},
    "work_center": {"work_center_id": "WC-GRIND-01", "description": "CNC Precision Surface Grinder 1"},
    "header": {
        "symptom_short_text": "Nital etch inspection revealed thermal grinding burn on rail running raceway",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-28",
        "found_date": "2026-08-13",
        "quantity_extent": "26 units affected",
    },
    "inspections": [
        {"characteristic": "Barkhausen noise peak", "measured_value": "85 mp", "spec_value": "max 35 mp"},
        {"characteristic": "Wheel dressing interval count", "measured_value": "55 parts", "spec_value": "max 20 parts"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-3882, Shift A - grinder operator extended dressing interval to reduce diamond dresser wear",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "EQ-GRIND01-002 spindle runout <1.5um, table hydraulic traverse speed consistent",
         "metric_value": "runout <1.5um", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "CNC grinding program dressing macro interval was modified from 20 parts to 55 parts, causing corundum grinding wheel loading and excessive frictional thermal spike >750C during finishing pass",
         "metric_value": "55 parts vs 20 standard", "is_root_cause": "Y", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Case-hardened alloy steel 58-62 HRC core structure and carbide distribution compliant",
         "metric_value": "60 HRC", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "Barkhausen noise grinding burn analyzer GA-0419 calibrated on master burn calibration blocks",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "High-pressure coolant flushing nozzle flow 85 l/min aligned to grinding contact zone",
         "metric_value": "85 l/min", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why did linear guide rails fail Nital chemical etching inspection?",
         "answer": "Dark re-tempered martensite thermal burn bands appeared along the precision raceway",
         "evidence_citation": "Nital etch inspection lot report QALS"},
        {"step_no": 2, "question": "Why did excessive frictional heat develop during grinding pass?",
         "answer": "The vitrified grinding wheel pores were loaded with steel swarf, causing rubbing instead of clean abrasive cutting",
         "evidence_citation": "Grinding wheel surface microscopic examination"},
        {"step_no": 3, "question": "Why was the grinding wheel glazed and loaded with swarf? (root cause)",
         "answer": "The diamond dressing cycle parameter was improperly raised from every 20 parts to every 55 parts in an unverified cycle-time change",
         "evidence_citation": "CNC program modification audit record PRG-GR200-01"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Guide Rail GR-200 ground on WC-GRIND-01 after part count #22 in grinding batch",
        "is_not_where_when_it_doesnt": "Parts #1 to #20 in the batch immediately following fresh diamond dressing",
        "notes": "Thermal burn strictly initiated after part 20 when abrasive wheel grains became glazed",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Perform 100% Barkhausen noise non-destructive inspection on all 26 quarantined guide rails"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Restore automated diamond dressing frequency to every 18 parts in CNC macro and dress wheel"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Lock dressing macro parameters in CNC controller under supervisor authorization key"},
    ],
    "fmea_link": {"fmea_id": "FMEA-GRIND-02", "description": "Thermal grinding burn and surface re-tempering due to wheel glazing and extended dressing"},
    "cost_copq": 16700,
    "lessons_learned": {
        "what_worked": "Barkhausen noise testing non-destructively identified the exact part #21 threshold where burn started",
        "what_didnt": "Operator adjusted wheel dressing frequency to save dressing diamond cost without consulting quality engineering",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100088", "partner_name": "Klaus Richter", "function_title": "Grinding Process Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 25 — Q3 Internal Defect · root cause MEASUREMENT · Completed
# ─────────────────────────────────────────────────────────────────────────────
CASE_10049120 = {
    "notification_id": "8D-10049120",
    "material": {"material_id": "MAT-10247", "description": "Bracket Housing X240",
                 "material_group": "MG-HOUSING"},
    "batch": {"batch_id": "B-50755"},
    "defect": {"defect_code": "DEF-1250", "defect_text": "Coordinate Measuring Machine false rejection on bolt circle true position"},
    "work_center": {"work_center_id": "WC-QA-01", "description": "Quality Metrology Laboratory CMM 1"},
    "header": {
        "symptom_short_text": "CMM reported bolt circle true position out of spec 0.085mm vs max 0.050mm limit",
        "team_size": 3,
        "origin": "Q3 - Internal Defect",
        "customer_facing_summary": None,
        "internal_facing_summary": None,
        "status": "Completed",
        "completion_date": "2026-08-28",
        "found_date": "2026-08-14",
        "quantity_extent": "40 units affected",
    },
    "inspections": [
        {"characteristic": "Bolt circle true position", "measured_value": "0.085mm (CMM)", "spec_value": "max 0.050mm"},
        {"characteristic": "CMM probe stylus ruby ball sphericity", "measured_value": "chipped 0.035mm flat", "spec_value": "max 0.002mm"},
    ],
    "causes_ishikawa": [
        {"category": "Man", "description": "EMP-9012, Shift A - CMM technician ran automated measurement routine per inspection plan",
         "metric_value": None, "is_root_cause": "N", "source": "ASSUMED: MES/HR"},
        {"category": "Machine", "description": "CMM EQ-CMM01-001 air bearings and linear glass scale optical readouts verified compliant",
         "metric_value": "air 5.2 bar", "is_root_cause": "N", "source": "SAP: EQUI/AFIH (PM)"},
        {"category": "Method", "description": "DOC-1108 Rev B - DMIS measurement alignment algorithm (3-2-1 primary datum) verified correct",
         "metric_value": None, "is_root_cause": "N", "source": "SAP: DRAW/PLPO (DMS+Routing)"},
        {"category": "Material", "description": "Bracket Housing X240 machined features inspected on optical vision machine were 100% within drawing tolerance",
         "metric_value": "true pos 0.022mm", "is_root_cause": "N", "source": "SAP: QALS/QAMR (incoming)"},
        {"category": "Measurement", "description": "CMM star probe stylus ruby ball GA-0012 had micro-chipped contact flat and loose M2 shank thread, generating 0.035mm directional hysteresis error during vector touch trigger probing",
         "metric_value": "35um hysteresis vs 2um max", "is_root_cause": "Y", "source": "SAP: Test Equipment Mgmt"},
        {"category": "Environment", "description": "Metrology lab temperature 20.0C +/- 0.3C / 45% RH strictly controlled",
         "metric_value": "20.0C", "is_root_cause": "N", "source": "ASSUMED: MES/IoT"},
    ],
    "five_why_chain": [
        {"step_no": 1, "question": "Why were 40 housing brackets quarantined as non-conforming?",
         "answer": "Automated CMM inspection reported bolt circle true position at 0.085mm exceeding the 0.050mm tolerance",
         "evidence_citation": "CMM inspection report CMM-2026-880"},
        {"step_no": 2, "question": "Why did re-measuring on an optical comparator show the parts were actually within tolerance (0.022mm)?",
         "answer": "The CMM touch-trigger probe recorded artificial position offsets during touch probing in the -Y vector direction",
         "evidence_citation": "Metrology cross-verification report TR-2026-112"},
        {"step_no": 3, "question": "Why did the CMM touch-trigger probe record artificial directional offsets? (root cause)",
         "answer": "The 3mm ruby ball stylus was micro-chipped on its equatorial contact zone and the M2 thread had loosened, creating 0.035mm mechanical hysteresis during touch deflection",
         "evidence_citation": "Stylus microscope inspection and qualification sphere error log"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "Housing X240 inspected on CMM 1 using probe configuration #3 on 2026-08-14",
        "is_not_where_when_it_doesnt": "Parts inspected on CMM 2 with verified stylus qualification run",
        "notes": "Defect was a measurement system artifact (false rejection) caused by a damaged probe stylus",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Release 40 falsely rejected housings following optical coordinate verification"},
        {"line_no": 2, "action_type": "Corrective", "status": "Verified",
         "action_text": "Replace damaged ruby stylus on CMM 1, torque M2 shank to 1.2 Nm, and re-qualify probe on reference sphere"},
        {"line_no": 3, "action_type": "Preventive", "status": "Verified in production",
         "action_text": "Implement mandatory automated reference sphere qualification routine before every shift inspection run in DMIS software"},
    ],
    "fmea_link": {"fmea_id": "FMEA-QA-01", "description": "False defect rejection and measurement bias due to chipped CMM probe stylus"},
    "cost_copq": 8200,
    "lessons_learned": {
        "what_worked": "Cross-measuring on optical comparator prevented unnecessary scrapping of 40 fully conforming housings",
        "what_didnt": "Stylus qualification on reference sphere was run weekly instead of daily at shift startup",
    },
    "customer_reference": {
        "complaint_reference": "N/A - Internal Defect",
        "customer_plant_contact": "N/A - Internal Defect",
        "sla_response_due": "N/A - Internal Defect",
    },
    "team_assignments": [
        {"partner_id": "BP-100001", "partner_name": "Heli Weber", "function_title": "Quality Engineer",
         "partner_role": "8D Team Leader", "source": "Backfilled from case record"},
        {"partner_id": "BP-100147", "partner_name": "Lena Hoffmann", "function_title": "Metrology Specialist",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
        {"partner_id": "BP-100011", "partner_name": "Quyen La", "function_title": "Quality Technician",
         "partner_role": "8D Team Member", "source": "Backfilled from case record"},
    ],
}


ALL_CASES = [
    CASE_10048420, CASE_10048577, CASE_10048603, CASE_10048651,
    CASE_10048702, CASE_10048745, CASE_10048788, CASE_10048811,
    CASE_10048834, CASE_10048857, CASE_10048880, CASE_10048903,
    CASE_10049010, CASE_10049020, CASE_10049030, CASE_10049040,
    CASE_10049050, CASE_10049060, CASE_10049070, CASE_10049080,
    CASE_10049090, CASE_10049100, CASE_10049110, CASE_10049120,
]

