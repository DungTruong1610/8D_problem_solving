# Summary of actual 8D resolution times

> **AI4Biz submission status:** This is preparation/reference material, not a confirmed final submission. Slides and presentation must be in English; PDF at most 15 slides, demo video at most 2 minutes, final pitch at most 15 minutes plus 5-minute Q&A, with at least 3 presenting members. Any longer English script is a rehearsal reference and must be adapted before submission.

> **Competition context:** [AI4Biz 2026 - LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

*Compilation date: 15 October 2026.*

**This document combines two reports:**

- [8D cycle time by industry.md](<8D Process Cycle Time Research.md>), drafted by Claude;
- "8D Process Cycle Time Research.md", the downloaded file.

**Method:** The original compilation reopened the source for each time figure to check it. Figures that could not be verified were moved to section 5 and excluded from the conclusions.

**Focus:** How long an 8D/CAPA process **actually** takes, based on publicly available external evidence.

## 0. Short answer

- **No measured industry-wide average exists for 8D specifically**, in any industry.
- **There is one measured dataset covering multiple companies**, but it concerns medical-device CAPA: MDIC 2023, 19 sites belonging to 8 corporations (Medtronic, Abbott, Stryker, Edwards, Baxter, Alcon, Illumina and Celonova).
  - At baseline, a CAPA took **379 days on average** from initiation to closure.
  - **65.6% of closed CAPAs took more than 180 days.**
  - The fast-track process took approximately 64 days, but this was measured during a two-year pilot and includes only closed CAPAs.
- **For automotive/manufacturing 8D, only a few individual cases have been published with specific dates:**
  - approximately **126 days** from the start of the response through the effectiveness assessment (Indonesia, 2020);
  - one 8D report took **71 days** against a 60-day deadline (Portugal, an example cited by the authors);
  - corrective actions were **scheduled** approximately 3-4 weeks after the complaint; the paper does not report the closure date (Fisker, 2023).
- **Customer deadlines are much shorter:**
  - containment (D3) within 24 hours to 3 days (semiconductors: 5 working days after preliminary failure analysis);
  - root cause and corrective action (D4-D5) within 5 working days to 30 days (semiconductors: approximately 36 working days, including the wait for failure analysis);
  - closure (D8) within 13-20 working days, or 30-90 days.
- **Actual performance often exceeds deadlines:**
  - At one automotive plant in Portugal, 80% of milestone checks were late.
  - In one warning letter, the FDA recorded a complaint investigation that remained incomplete after approximately 7 months.

### Classifications used in this document

| Label | Meaning |
| - | - |
| **MEASURED** | Measured from actual company, association or regulator records |
| **CA/CAPA** | Corrective action / corrective and preventive action |
| **DEADLINE** | A deadline read directly in the issuing organization's source document. *(secondary)* means it was read only through a source citing that document |
| **ESTIMATE** | An estimate or projection |
| **VENDOR CLAIM** | A marketing claim without verifiable supporting data |

> The downloaded original report includes verbatim quotations. This synthesis replaces them with **precise source locations** (page, section and table) and paraphrases so readers can check the source themselves.

## 1. MEASURED ACTUAL RESOLUTION TIMES - main focus

### 1.1 Summary table

| # | Industry / context | Measured result | 8D/CAPA stage | Year, sample size | Source location | Source |
| - | - | - | - | - | - | - |
| M1 | **Medical devices, multiple companies** (MDIC; data from 19 sites of 8 corporations; FDA participated in the working group) | **Baseline: average total cycle of 379 days** = initiation 43 days + implementation **221 days** + closure/effectiveness checks **131 days** | Full CAPA lifecycle (approximately D0-D8) | 2022-23; n = 673 CAPAs | Figure 7, page 18. The text states that implementation takes more than 220 days and closure takes more than a year | [MDIC Make CAPA Cool v16](https://mdic.org/wp-content/uploads/2023/05/2022-MDIC-Make-CAPA-Cool-Whitepaper_v16.pdf) |
| M2 | Same as above | **Duration distribution of closed CAPAs at baseline (n = 302):** up to 30 days: 28 (9.3%); 31-60: 12; 61-90: 17; 91-120: 16; 121-150: 14; 151-180: 17; **over 180 days: 198 (65.6%)**. Therefore 90.7% / 86.8% / 81.1% closed after more than 30 / 60 / 90 days | Same as above | n = 302 | Figure 6, page 18 | Same as above |
| M3 | Same as above, **fast-track pilot** (low risk) | **Approximately 64 days** (approximately 2 months); implementation **47 days** (under 50 days) | Full lifecycle | n = 711 | Figure 7 and text on page 18: implementation under 50 days and closure in only 2 months | Same as above |
| M4 | Same as above, **external CAPA pilot** (high risk / reportable) | **270 days**; initiation 13, implementation 167, closure 100 (the same column order as the baseline row, consistent with MDIC's text) | Full lifecycle | n = 187 | Figure 7, page 18 | Same as above |
| M5 | Same as above, entire pilot (n = 553) | Up to 30 days: 217 (39.2%); **over 180 days: 21 (3.8%)**. MDIC states that **approximately 60% closed within 60 days**. Large sites (over 1,000 staff): approximately 60% closed within 60 days; medium sites (100-1,000): only approximately 15% | Full lifecycle | n = 553; large sites n = 431, medium sites n = 67. **Only CAPAs closed during the two-year pilot are included**, which tends to understate duration | Figures 6 and 9, pages 18-19 | Same as above |
| M6 | Same as above | **Repeat CAPA rate: 16% (baseline) to 0.4% (pilot)** | Recurrence after closure | Not stated | Pages 19-20 | Same as above |
| M7 | **Automotive, Portugal** (in-car multimedia systems) | **151/189 milestone checks were late (80%)**. The authors give an example of an 8D report taking **71 days** against a 60-day deadline | D1, D2-D3, D4-D5, D1-D8 | 2009 study; 189 milestone checks (number of reports not stated) | POMS 2010, section 3.2 (page 10) | [Riesenberger & Sousa, POMS](https://pomsmeetings.org/confpapers/015/015-0345.pdf) |
| M8 | Same as above | Of 984 complaints in 2008, **543 were repeat complaints (55%)**. After moving 8D into SAP with automatic reminders and digital signatures, the subsequent checked sample had **no late checks** | Recurrence; deadline compliance | 984 complaints | Sections 3.1 and 3.5 | Same as above, and [IAENG WCE 2010](https://www.iaeng.org/publication/WCE2010/WCE2010_pp2225-2230.pdf) |
| M9 | **Automotive, Romania** (powder-coated roof rails, 229 defective parts) | Dates printed in the paper: production 18 September 2019; detection 30 September 2019; root-cause analysis completed 20 October; D8 items dated 4 November 2019. **Not used as a measurement:** the paper was received on 20 June 2019 and accepted on 15 August 2019, *before* the case dates; the action plan also specifies weeks W46-W49. The dates are illustrative | D1-D8, one case | 2019; 1 case with inconsistent data | Tables 2, 5, 6, 8 and 9 | [Banica & Belu 2019, University of Pitesti](https://automotive.upit.ro/2019/2019_5_.pdf) |
| M10 | **Automotive, Indonesia** (seat belts, SB3 line) | Started on 27 March 2020, assessed through the end of July 2020: **approximately 4 months (126 days)** to reduce defects from 60 to 0 units per month | D1-D8 including effectiveness monitoring | 2020; 1 case | Methods, pages 2-3 | [Rusman & Hetharia 2025, Operations Excellence 17(1)](https://publikasi.mercubuana.ac.id/index.php/oe/article/view/20205) |
| M11 | **Automotive** (seat-belt buckle, Fisker customer) | Complaint on 16 May 2023; plant received the defective sample on 24 May (**8 days**); corrective-action deadlines in **weeks 23-24 of 2023 (approximately 3-4 weeks after the complaint)**. The paper **does not provide a closure date** | D1-D6 | 2023; 1 case | D2 and D5-D6 sections (pages 10-22) | [Processes 13(10):3121, 2025](https://www.mdpi.com/2227-9717/13/10/3121) |
| M12 | **Automotive** (AI/IoT pilot) | D1 and D3 reduced from hours to **less than 1 minute**. No full-cycle duration reported | D1 and D3 only | 2025; 1 case | D1/D3 descriptions | [Oancea et al., Applied Sciences 15(20):11262](https://www.mdpi.com/2076-3417/15/20/11262) |
| M13 | **Medical devices, USA** (FDA warning letter, Envoy Medical) | Complaint received on 25 November 2024. At the end of the inspection on 2 July 2025, the investigation **remained incomplete after approximately 7 months (219 days)** | D1-D4 | 2025; 1 record | Letter CMS #718762, 11 November 2025 | [FDA - Envoy Medical](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/envoy-medical-inc-718762-11112025) |
| M14 | **Pharmaceuticals**, one multinational site inspected by EMA | Only **65% of CAPAs closed within 30 days**; improved to 92% on time after 6 months | CAPA closure | Sample size not stated (secondary) | Clinplex, citing Quality Executive Partners | [Clinplex](https://clinplex.com/resources/deviation-investigation-cost-capa-closure-benchmarks) |

### 1.2 How to interpret the table

- **The only large dataset concerns medical-device CAPA (MDIC).** A CAPA in this context often includes process or design revalidation, making it much longer than automotive 8D.
  - 379 days is the participating companies' **pre-improvement baseline**.
  - The fast-track route for low-risk issues took approximately 64 days.
- **MDIC pilot figures** (M3-M6) include only CAPAs closed during the two-year pilot. Records still open at its end are excluded, so the 64-day duration, 3.8% taking over 180 days, and 0.4% repeat rate may be below long-term results.
- **Automotive 8D cases with usable dates** (M7, M10, M11) indicate actual durations **from several weeks to approximately 4 months**. M9 cannot be used because its dates are inconsistent. A few cases are insufficient to establish an industry average.
- Rusman & Hetharia cite Sharma et al. (2020) as saying that 8D projects often last up to approximately 3 months. This is **secondary evidence**, not a measurement.

## 2. CUSTOMER AND STANDARD DEADLINES (DEADLINE)

### 2.1 Read directly in the original documents

| Organization (industry) | Containment D1-D3 | Root cause / CA/CAPA D4-D5(6) | Completion / closure D8 | Unit | Source |
| - | - | - | - | - | - |
| **Volkswagen** - Formel Q konkret, 6th edition, October 2021 (automotive; a 7th edition dated March 2025 exists but was not read) | 8D report by the next working day; preliminary analysis within **3 working days** | Long-term measures updated within **10 working days** | Complete 8D within **20 working days**. If late without prior agreement, the complaint is closed after 4 weeks at the supplier's expense | Working days | Section 4.4.1.1, [PDF](http://www.navistarsupplier.com/Documents/IntegratedSupplierQuality/Formel%20Q%20Konkret.pdf) |
| **Schaeffler** - P 170508 Annex 3, revision B, March 2022 (automotive) | **24 hours** | D1-D5 within **5 working days** | After effectiveness verification; no fixed number of days. Serious or recurring defects require "8D-Report Plus" | Hours / working days | [Schaeffler](https://www.schaeffler.de/remotemedien/media/_shared_media_rwd/01_company_1/suppliers_4/quality_1/p170508/p170508_a3_schaeffler_complaint_process_de.pdf) |
| **MAHLE** - 1-5-20 rule (automotive) | 1 day (24 hours) | 5 working days | **20 working days** | Working days | [MAHLE](https://www.mahle.com/media/global/purchasing/supplier-portal/8d-e-learning/manual_8d-process_en-ex.pdf) |
| **KSR International** - Supplier Handbook, July 2023 (automotive) | 24 hours (1 working day) | Not stated | Corrective action: **14 working days** | Working days | [KSR](https://ksrint.com/wp-content/uploads/2023/07/GLB-SD-F-45_Supplier-Handbook.pdf) |
| **Novares** - 2018 (automotive) | Containment plan within 24 hours | CA/CAPA plan (8D) within **10 days** | Not stated | Days | [Novares](https://www.novaresteam.com/wp-content/uploads/2018/10/Global_Supplier_Quality_Requirements_Manual.pdf) |
| **Stellantis** - IATF CSR v1, June 2025 (automotive) | 8D required through Amadeus/SQP or NCT&GIM | Specific deadlines are in GSQN.001, which is **not public** | Not stated | Not stated | [Stellantis CSR](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/06/STELLANTIS-CSR-for-use-with-IATF16949-v1.pdf) |
| **IATF Rules, 5th edition** - SI November 2023 (audit findings) | Major nonconformities: interim correction and root cause within **20 calendar days** | Systemic corrective action and effectiveness verification within **60 calendar days** | Certification body decides within **90 calendar days** | Calendar days | Sections 5.11.1-5.11.3, [IATF SI](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2023/11/IATF-Rules-5th-Edition-Sanctioned-Interpretations-Nov-2023.pdf) |
| **IATF Rules, 6th edition** (2025) | Major nonconformities: **15 calendar days** | 60 calendar days | Not stated | Calendar days | *(secondary)* [LRQA](https://www.lrqa.com/en-us/latest-news/understanding-iatf-16949-6th-edition/) |
| **AS13000** (aerospace engines) | D0 within **2 days** | D5 within **30 days**, unless otherwise agreed | Not stated | Days | *(secondary)* [Scrimshire](https://www.linkedin.com/pulse/8-d-problem-solving-process-dr-david-scrimshire) |
| **Barnes Aerospace** - October 2023 (aerospace, AS13000) | Containment results within **24 hours** | CA/CAPA plan within **30 days** | Not stated | Days | [Barnes](https://barnesaero.com/wp-content/uploads/2023/10/Supplier-Quality-Requirements_Lansing.pdf) |
| **Lockheed Martin / Derco** - QA100-102, February 2021 (defence) | Report flight-safety issues within **24 hours**; other issues within **5 working days** | Not stated | Not stated | Hours / working days | [Derco](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/derco-aerospace/QA100-102SupplierQualityManual-REV-02-24-21.pdf) |
| **Oshkosh** - OSK-P3000 (defence, specialty vehicles) | 24 hours | D4 within 15 days; D6 within 30 days | D8 within **45 calendar days** | Calendar days | [Oshkosh](https://osn.oshkoshcorp.com/-/media/OSN/supplier-resources/Training/SQ-Core-Tools/8D-Corrective-Action/8D-Corrective-Action-Procedure.pdf) |
| **Silicon Labs** (semiconductors) | 8D containment within **5 working days** after preliminary failure analysis, which takes 7 working days | Final failure analysis: **22 working days**; root cause and CA/CAPA plan **14 working days** later | Approximately 36 working days cumulatively before D6 *(calculated here)* | Working days | [Silicon Labs FAQ](https://www.silabs.com/about-us/quality/quality-faq) |
| **Creation Technologies** - September 2022 (electronics/EMS) | 3 working days | 10 working days | SCAR response within **30 calendar days** | Working / calendar days | [Creation](https://www.creationtech.com/wp-content/uploads/2022/09/8D-Supplier-Training-9-22-22.pdf) |
| **Keysight** (electronic test equipment) | Not stated | SCAR response within **14 days** | Not stated | Days | [Keysight](https://about.keysight.com/en/supplier/KeysightRCCA_Guideline.pdf) |
| **SEW-EURODRIVE** - 2019 (industrial drives) | 3 working days | Not stated | D4-D8 within the **next 10 working days** (13 working days total) | Working days | [SEW](https://media.sew-eurodrive.com/sew_de/media/nocms_media/lieferantenhandbuecher_1/8d-process-specification.pdf) |
| **BSH** - 2021 (appliances, Bosch Booklet 16) | D3: 2 days | D4: 14 days; D5: 60 days | Full response within **90 days**, contractually | Days | [BSH](https://media3.bsh-group.com/Documents/25319795_Overview_ProblemSolving_with_8D_EN-v1.pdf) |
| **DeLaval** - July 2026 (agricultural equipment) | D3: 1 day | D4: 7 days; D5-D6: 7 days | D7: 14 days | Days | [DeLaval](https://www.delaval.com/globalassets/global/suppliers/8d_info-for-suppliers_2026_07.pdf) |

**Medical devices and pharmaceuticals:**

- Regulations require CAPA (21 CFR 820.100, transitioning to QMSR/ISO 13485 section 8.5.2; 21 CFR 211.192), but **do not prescribe a closure deadline** or require the 8D template.
- After receiving Form 483, companies are advised to respond within **15 working days** ([JMDR 2023](https://uhra.herts.ac.uk/id/eprint/14816/1/JMDRFeb2023-CAPAviolations-edited-v1_1_.pdf)).

### 2.2 Included in the downloaded report, but original documents could not be read (reference only)

| Organization | Deadline in the downloaded report | Why unverified |
| - | - | - |
| Ford (CSR) | 24 hours for D0-D3; 48 hours to notify FCSD; **full 8D within 15 calendar days** | Source is the qmslearning.com blog; original CSR available only through the supplier portal |
| GM (GM 1927 / QSB) | 24 hours for D3; 7 days for D4; 14 days for D5-D6; closure target 30 days, maximum 40 days | Scribd copy could not be downloaded |
| Continental (QPR) | 24 hours; D1-D3 within 2 working days | Scribd copy could not be downloaded |
| Grupo Segura (February 2026) | Under 24 hours for D3; 3 days for D5-D6; 10 days for D8 | Could not connect to fsegura.com |
| Safran | S0/D0 within 2 days | Download URL returned an HTML page |
| Xdpigo (electronic cables) | Containment within 48 hours; RMA review within 30 days | Marketing page |

## 2.3 Which industries require 8D: summary

| Industry | Is 8D mandatory? | Verified basis | Scale |
| - | - | - | - |
| Automotive | A problem-solving process is required (IATF 16949 section 10.2.3). Customers require the 8D format: Stellantis, VW, Schaeffler, MAHLE, KSR and Novares | Section 2.1 | 104,216 IATF sites (942 in Vietnam) |
| Aerospace engine supply chain | Yes, AS13000 when required by the customer | AS13000 *(secondary)*, Barnes | No public count |
| Electronics / semiconductors | Customer requirements (SCAR, 8D). The downloaded report cites JESD671 and AEC-Q100 Rev J, **not yet verified** | Silicon Labs, Creation, Keysight | No separate count |
| Medical devices, pharmaceuticals | CAPA required (21 CFR 820.100 / QMSR; 211.192). **No** mandatory 8D template or closure deadline | FDA, JMDR | ISO 13485: 43,957 sites |
| Defence, appliances, rail, industrial equipment, contract manufacturing | Contract / customer requirements | Oshkosh, Derco, BSH, SEW, DeLaval | No count available |

## 3. ADOPTION SCALE AND AUDIT DATA (MEASURED)

| Metric | Value | Source |
| - | - | - |
| Sites certified to IATF 16949 (automotive) | **104,216** as of 20 December 2025. China 61,537; India 7,718; South Korea 5,334; USA 3,693; Germany 2,700; **Vietnam 942** | [IATF Global Oversight, 2025-11 distribution](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/12/2025-11_GlobalCertDistribution.pdf) |
| Most common major nonconformities in IATF audits (rolling 12 months to August 2026) | **10.2.3 Problem solving: 12.10%** (rank 1); 10.2.1 Nonconformity and corrective action: 5.60% (rank 2) | [IATF Top Ten Major NC 2026-08](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2026/09/2026-08_TopTenMajorNC-12MonthMD-EN.pdf) |
| ISO 13485 certificates (medical devices) | 31,215 certificates / 43,957 sites (ISO Survey 2024) | [GlobalSTD infographic](https://www.globalstd.com/wp-content/uploads/2025/10/Infografia-ISO-Survey-2024_EN.pdf) |
| CAPA deficiencies in FDA medical-device Form 483 observations | 820.100 accounts for **13.8% / 13.1% / 12.9%** of observations in FY2023 / FY2024 / FY2025, consistently ranked first. Only electronically prepared Form 483s are included | Calculated in the original compilation from [FDA files](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/inspection-references/inspection-observations) |
| Deviation-investigation deficiencies in pharmaceutical Form 483 observations | 211.192 accounts for **8.2% / 7.0% / 8.3%**, ranked second | Same as above |
| FDA warning letters involving CAPA (medical devices, 2013-2019) | 355 letters, 407 violations | [Anderson & Tan, JMDR 2023](https://uhra.herts.ac.uk/id/eprint/14816/1/JMDRFeb2023-CAPAviolations-edited-v1_1_.pdf) |

## 4. Three additional questions

**(a) Lateness and records open for more than 30 / 60 / 90 days**

- **MDIC** (medical devices, multiple companies):
  - Baseline: **90.7% / 86.8% / 81.1%** of closed CAPAs took more than 30 / 60 / 90 days; **65.6% took more than 180 days**.
  - Pilot, closed CAPAs only: **3.8%** took more than 180 days; approximately 60% closed within 60 days.
- **Automotive, Portugal:** 80% of milestone checks were late.
- **Pharmaceuticals, one site:** 35% of CAPAs did not close within 30 days.

**(b) Recurrence after closure**

- **MDIC:** repeat CAPAs decreased from **16% to 0.4%** during the pilot.
- **Automotive, Portugal:** 55% of complaints in 2008 were repeats. This is complaint recurrence, not necessarily recurrence after 8D closure.
- Beyond these two sources, **no industry-level recurrence figures are available**.

**(c) Where time is concentrated**

- **MDIC actual measurements:**
  - Most time is spent **implementing corrective actions: 221/379 days (58%)**, followed by **closure/effectiveness checks: 131 days**.
  - **Initiation** takes 43 days, mainly waiting for review-board classification.
- **Portugal case:** delays mainly involve waiting and administration:
  - untracked laboratory analysis;
  - 3 paper signatures;
  - no deadline alerts;
  - data split across separate systems.
- **AI pilot** (M12): D1 and D3 can be reduced to minutes. The remaining time lies in D4-D7.

## 5. Figures in the downloaded report that were CORRECTED or EXCLUDED

| Downloaded report content | Check result | Treatment |
| - | - | - |
| MDIC: "external CAPA 167 days; fast-track 270 days"; "baseline: implementation 131, closure 221"; "projection: implementation 37, closure 84" | Chart misread. MDIC's text on page 18 states that baseline implementation exceeds 220 days, fast-track implementation is under 50 days, and closure takes approximately 2 months. Figure 8 projects implementation at 84 days and closure at 37 | **Corrected** (M1, M3, M4). The 130-day projection remains an ESTIMATE |
| MDIC pilot: "31-60 days: 75 CAPAs; 61-90: 110" | Chart ordering cannot be read clearly. This reading gives only 52.8% closing within 60 days, inconsistent with MDIC's "approximately 60%" | Retain only up to 30 days, over 180 days and "approximately 60%" |
| "8D reduced from 63 to 41 days" (attributed to ResearchGate 337834285 / Banica & Belu 2019) | Full text of Banica & Belu 2019 was read: it **does not contain** this figure | **Excluded** |
| "India 2026: 63 to 39 days, team formation from 1.8 days to 38 minutes" (ResearchGate 408051737) | ResearchGate blocked access; the paper could not be found elsewhere | **Unverified**, not used |
| "Painted metal rail case: 12 days" | Correct: production on 18 September and detection on 30 September 2019. But this is **defect-detection latency**, not 8D duration | Retained with scope clarified (M9) |
| "Seat belts approximately 120 days" | Broadly correct: 27 March to the end of July 2020 (approximately 126 days) | Retained (M10) |
| "Noah Medical: CAPA open for approximately 24 months (726 days)" | FDA letter does not say CAPA 23-005 remained open; CAPA 24-028 was opened by the company in its response letter | **Excluded** the 726-day figure |
| "Medline: 3 quarters (270 days)" | Taken from an aggregation blog; original letter not read | Not used |
| "Formly.ai: average 116 days (60-128)" | The page explicitly labels this an **Example List of CAPAs**, not real data | **Excluded** |
| "Elevate-CAPA: median 13 months" | The downloaded report itself calls it sample data; server could not be accessed | **Excluded** |
| "IATF: maximum 90 days to close audit findings" | 90 days is the **certification body's** decision deadline. The company must submit within 20/60 days (5th edition) or 15/60 days (6th edition) | **Corrected** |
| "VW: complete 8D within 10 working days" | 10 working days is the deadline for updating long-term measures. **8D completion: 20 working days** (6th edition) | **Corrected** |
| "Silicon Labs applies JESD671" | FAQ gives response times but does not mention JESD671 | Removed this connection |
| "LNS Research: from over 60 days to 15-20 days" | Actually a market-research page citing software vendor Pyraman | Reclassified as VENDOR CLAIM |
| Author's original report: "93,713 IATF sites" | Outdated. Official figure: 104,216 on 20 December 2025 | **Corrected** |

## 6. Software vendor claims (VENDOR CLAIM, excluded from conclusions)

- Jodoo: 8D closure from 18 to 11 days.
- iFactory: biogas-plant CAPA from 34 to 8 days; paper NCRs 40-90 days versus digitized NCRs 8-20 days.
- Oxmaint: 47 to 15 days.
- eLeap: 45 to 30 or 18 days.
- ERPDrive: 8D response from 5 days to under 8 hours.
- Pyraman, via Dimension Market Research: over 60 days to 15-20 days.

Other practitioner estimates are also classified as ESTIMATE: Chartered Semi 60-90 days; QMS Learning 30-60 days; and 8D templates on Scribd.

## 7. Conclusions (MEASURED and DEADLINE figures only)

1. **There is no measured industry-wide average for 8D specifically.** The only multi-company dataset concerns medical-device CAPA (MDIC, 19 sites / 8 corporations): **379 days on average**, with 65.6% of closed CAPAs taking over 180 days. During the two-year pilot, the low-risk fast track measured approximately 64 days, counting only closed CAPAs.
2. **Automotive 8D cases with public dates:** approximately **126 days** (Indonesia 2020); one report taking **71 days** against a 60-day deadline (Portugal); corrective actions **scheduled** approximately 3-4 weeks after a complaint, with no reported closure date (Fisker 2023).
3. **Customer deadlines:**
   - containment within **24 hours to 3 days** (semiconductors: 5 working days after preliminary failure analysis);
   - root cause and corrective action within **5 working days to 30 days** (semiconductors: approximately 36 working days);
   - 8D completion within **13-20 working days** (SEW, MAHLE, VW), with **30-90-day milestones** in AS13000, Barnes, Oshkosh and BSH. The table above distinguishes corrective-action plans from final closure.
4. **Actual performance often misses deadlines:**
   - Automotive, Portugal: 80% of milestone checks late; 55% of complaints repeated.
   - FDA: one complaint investigation remained incomplete after approximately 7 months.
   - IATF: "Problem solving" (10.2.3) is the leading major nonconformity at 12.10% (August 2026), in a certification population of 104,216 sites.
5. **Vietnam:** 942 IATF 16949 sites as of 20 December 2025 are subject to customer 8D requirements. **No public study measuring 8D duration in Vietnam**, China or Germany was identified in this compilation.

## 8. Sources (accessed 15 October 2026)
1. MDIC (2023). *CAPA Process Improvement - #makeCAPAcool Program*, whitepaper v16, 02/05/2023. Two-year pilot; 19 sites belonging to 8 corporations (Table 2, page 15). https://mdic.org/wp-content/uploads/2023/05/2022-MDIC-Make-CAPA-Cool-Whitepaper_v16.pdf
2. Riesenberger, C. & Sousa, S.D. (2010). POMS 21st Conf. https://pomsmeetings.org/confpapers/015/015-0345.pdf ; WCE 2010 (IAENG). https://www.iaeng.org/publication/WCE2010/WCE2010_pp2225-2230.pdf
3. Banica, C.-F. & Belu, N. (2019). *Application of 8D methodology - an effective problem solving tool in automotive industry.* Scientific Bulletin Univ. Pitesti, Automotive series. https://automotive.upit.ro/2019/2019_5_.pdf
4. Rusman, K. & Hetharia, D. (2025). *Quality improvement through 8D methodology: an automotive industry case study.* Operations Excellence 17(1):1-11. https://publikasi.mercubuana.ac.id/index.php/oe/article/view/20205
5. *Processes* 13(10):3121 (2025), Fisker seat-belt buckle case. https://www.mdpi.com/2227-9717/13/10/3121
6. Oancea, A.-V. et al. (2025). *Applied Sciences* 15(20):11262. https://www.mdpi.com/2076-3417/15/20/11262
7. US FDA, warning letters Envoy Medical (CMS #718762, 11/11/2025) and Noah Medical (CMS #702414, 09/04/2025). https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/envoy-medical-inc-718762-11112025 ; https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/noah-medical-corporation-702414-04092025
8. US FDA, Inspection Observations FY2023-FY2025. https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/inspection-references/inspection-observations
9. Anderson, R. & Tan, C. (2023). JMDR. https://uhra.herts.ac.uk/id/eprint/14816/1/JMDRFeb2023-CAPAviolations-edited-v1_1_.pdf
10. IATF Global Oversight: certification distribution 2025-11; Top Ten Major NC 2026-08; Rules edition 5 SI 11/2023. https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/12/2025-11_GlobalCertDistribution.pdf ; https://www.iatfglobaloversight.org/wp/wp-content/uploads/2026/09/2026-08_TopTenMajorNC-12MonthMD-EN.pdf ; https://www.iatfglobaloversight.org/wp/wp-content/uploads/2023/11/IATF-Rules-5th-Edition-Sanctioned-Interpretations-Nov-2023.pdf
11. Volkswagen, Formel Q konkret edition 6 (10/2021). http://www.navistarsupplier.com/Documents/IntegratedSupplierQuality/Formel%20Q%20Konkret.pdf
12. Schaeffler, P 170508 Anlage 3 (2022-03). https://www.schaeffler.de/remotemedien/media/_shared_media_rwd/01_company_1/suppliers_4/quality_1/p170508/p170508_a3_schaeffler_complaint_process_de.pdf
13. MAHLE, SQA 8D manual. https://www.mahle.com/media/global/purchasing/supplier-portal/8d-e-learning/manual_8d-process_en-ex.pdf
14. KSR International, Supplier Handbook GLB-SD-F-45 (07/2023). https://ksrint.com/wp-content/uploads/2023/07/GLB-SD-F-45_Supplier-Handbook.pdf
15. Novares, Global Supplier Quality Requirements Manual (2018). https://www.novaresteam.com/wp-content/uploads/2018/10/Global_Supplier_Quality_Requirements_Manual.pdf
16. Stellantis, CSR for IATF 16949 v1 (06/2025). https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/06/STELLANTIS-CSR-for-use-with-IATF16949-v1.pdf
17. Barnes Aerospace, Supplier Quality Requirements - Lansing (10/2023). https://barnesaero.com/wp-content/uploads/2023/10/Supplier-Quality-Requirements_Lansing.pdf
18. Lockheed Martin / Derco Aerospace, QA100-102 (02/2021). https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/derco-aerospace/QA100-102SupplierQualityManual-REV-02-24-21.pdf
19. Oshkosh, OSK-P3000. https://osn.oshkoshcorp.com/-/media/OSN/supplier-resources/Training/SQ-Core-Tools/8D-Corrective-Action/8D-Corrective-Action-Procedure.pdf
20. Silicon Labs, Quality FAQ. https://www.silabs.com/about-us/quality/quality-faq
21. Creation Technologies (09/2022). https://www.creationtech.com/wp-content/uploads/2022/09/8D-Supplier-Training-9-22-22.pdf ; Keysight RCCA Guideline. https://about.keysight.com/en/supplier/KeysightRCCA_Guideline.pdf
22. SEW-EURODRIVE (2019). https://media.sew-eurodrive.com/sew_de/media/nocms_media/lieferantenhandbuecher_1/8d-process-specification.pdf ; BSH (2021). https://media3.bsh-group.com/Documents/25319795_Overview_ProblemSolving_with_8D_EN-v1.pdf ; DeLaval (07/2026). https://www.delaval.com/globalassets/global/suppliers/8d_info-for-suppliers_2026_07.pdf
23. AS13000 *(secondary)*: https://www.linkedin.com/pulse/8-d-problem-solving-process-dr-david-scrimshire ; IATF edition 6 *(secondary)*: https://www.lrqa.com/en-us/latest-news/understanding-iatf-16949-6th-edition/
24. Clinplex. https://clinplex.com/resources/deviation-investigation-cost-capa-closure-benchmarks ; ISO Survey 2024 (GlobalSTD). https://www.globalstd.com/wp-content/uploads/2025/10/Infografia-ISO-Survey-2024_EN.pdf
25. Formly/Dovetail, example CAPA list (excluded). https://docs.withdovetail.com/tasks/list-capa
