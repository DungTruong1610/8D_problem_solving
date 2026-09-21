"""
Tám case bổ sung, nâng bộ mock lên 12.

── Mục tiêu ──
1. Phủ đủ 6 nhánh Ishikawa làm nguyên nhân gốc (bộ 4 case đầu chỉ có 4 nhánh).
2. Cân bằng Q1 / Q3 và cả ba trạng thái.
3. QUAN TRỌNG NHẤT: hai case cố ý MẬP MỜ, nơi bằng chứng chống lưng cho một nhánh
   khác với nhánh kỹ sư đã ghi.

── Vì sao cần case mập mờ ──
Nếu mọi case đều rõ ràng và AI luôn đồng ý với kỹ sư, ta không phân biệt được
"AI suy luận đúng" với "AI đoán bừa rồi may". Chỉ khi có case mà bằng chứng
nghiêng về nhánh khác, phản ứng của AI mới nói lên điều gì đó: nó dám chọn theo
số liệu, hay nó chiều theo con số quen thuộc?

Hai case đó được đánh dấu `_design_note` — trường này KHÔNG đi vào file JSON sinh
ra, chỉ để người đọc code hiểu ý đồ.
"""

# ─────────────────────────────────────────────────────────────────────────────
# Case 5 — Q3 · root MAN · Closed
# Thao tác viên bỏ bước siết lực theo quy trình.
# ─────────────────────────────────────────────────────────────────────────────
CASE_10048702 = {
    "notification_id": "8D-10048702",
    "material": {"material_id": "MAT-10611", "description": "Gearbox End Cap G45"},
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
    "material": {"material_id": "MAT-10744", "description": "Sensor Mount Bracket S22"},
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
    "material": {"material_id": "MAT-10820", "description": "Rotor Shaft R60"},
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
    "material": {"material_id": "MAT-10905", "description": "Manifold Block M12"},
    "batch": {"batch_id": "B-53344"},
    "defect": {"defect_code": "DEF-1015", "defect_text": "Port thread depth insufficient"},
    "work_center": {"work_center_id": "WC-DRILL-06", "description": "Multi-Spindle Drilling Line 6"},
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
         "evidence_citation": "NC program archive WC-DRILL-06"},
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
    "material": {"material_id": "MAT-11002", "description": "Spring Retainer SR8"},
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
    "material": {"material_id": "MAT-11130", "description": "Bearing Cap BC14"},
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
    "material": {"material_id": "MAT-11244", "description": "Valve Body V30"},
    "batch": {"batch_id": "B-54390"},
    "defect": {"defect_code": "DEF-1340", "defect_text": "Pocket depth inconsistent across units"},
    "work_center": {"work_center_id": "WC-MILL-14", "description": "CNC Milling Line 14"},
    "header": {
        "symptom_short_text": "Valve body pocket depth varying unit to unit",
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
         "evidence_citation": "Shift handover note WC-MILL-14"},
    ],
    "is_is_not": {
        "is_where_when_it_happens": "V30 pockets milled on WC-MILL-14 across all three shifts from 2026-07-17",
        "is_not_where_when_it_doesnt": "V30 milled on WC-MILL-09 - same program revision, same castings, same operators rotating through",
        "notes": "Defect appears on every shift at WC-MILL-14, not only on Shift C",
    },
    "actions": [
        {"line_no": 1, "action_type": "Containment", "status": "Done",
         "action_text": "Quarantine batch B-54390 and gauge pocket depth on 100% of V30 stock"},
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
CASE_10048903 = {
    "notification_id": "8D-10048903",
    "material": {"material_id": "MAT-11388", "description": "Trim Panel T18"},
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


EXTRA_CASES = [
    CASE_10048702,
    CASE_10048745,
    CASE_10048788,
    CASE_10048811,
    CASE_10048834,
    CASE_10048857,
    CASE_10048880,
    CASE_10048903,
]
