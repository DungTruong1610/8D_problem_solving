# Changelog

## [Unreleased]

### Added
- Preventive maintenance proposal on D7 (panel "Đề xuất bảo trì phòng ngừa").
  - Rule-based, in `srv/src/domain/eightd/maintenance/`. Input is the approved D4 root cause plus closed cases with the same defect code and work center.
  - The marked 6M category picks the control type: maintenance, calibration, error-proofing, work instruction, incoming inspection or condition monitoring.
  - An interval or limit is only taken from measured text. If none is found, the interval is left empty and an `unverified-facts` stop is raised.
  - If no cause in the 5-Why chain is one the plant controls, the only proposal is "increase inspection frequency", with an `outside-scope` stop.
  - Every proposal cites its source case IDs.
- New service operations:
  - `proposeMaintenancePlan` builds the proposals.
  - `decideMaintenanceProposal` approves or rejects one proposal. It writes a `maintenance-decision` row to `ReviewEvents`, and the actor comes from the server, not the client.
  - `getMaintenanceHistory` returns the approved proposals for one defect type.
- New D7 field `preventive.maintenancePlan`.
- The panel shows real day gaps between occurrences of the same defect type, before and after the preventive action. It makes no forecast.
- `mock-data/happycase-full/`: 10 open 8D cases (8D-10049401..410) for import via
  Create 8D Report → JSON. Each one carries the team, inspection lot history,
  Is/Is-Not, Ishikawa, 5-Why, actions, FMEA and closure data, so D1–D8 all find
  precedents, D3/D5/D7 owners are named, and D2 Is/Is-Not is computed.
- Closed case library: 10 closed precedents 8D-10049140..330 (`mock-data/cases_clean.py`),
  one per happy case, on the same work center, defect code and material.
  None is on WC-COAT-05, so 8D-10048651 stays the "no precedent" demo case.
- Inspection History: 36 inspection lots for 6 new material/characteristic pairs
  (`scripts/generate-comprehensive-seed.mjs`).
- Value helps: 18 batches and 10 inspection characteristics for these cases
  (`srv/src/domain/eightd/valueHelpSeeder.ts`).

### Fixed
- Graph precedent retrieval returned no precedents at all on SQLite (local dev).
  The raw SQL in `graph/hydrate.ts` and the re-rank text query in `graph/engine.ts`
  selected columns without an alias. SQLite then returns them as `notificationId`,
  not `NOTIFICATIONID`, so every scored case was dropped. HANA was not affected.
- The 8D report page showed "Loading report…" until D1–D8 had all finished, then all
  eight steps at once. The background analysis ran inside one `cds.spawn` transaction
  that held the only SQLite connection until the end, so the page's request waited and
  no step was committed early. The job now runs without a surrounding transaction and
  commits each step on its own (`srv/src/services/eightDService.ts`), so D1 appears
  first and the other steps show as pending until they are ready.
