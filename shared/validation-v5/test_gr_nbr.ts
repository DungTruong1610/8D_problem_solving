import { evaluateValidationConfigV5 } from './index';

// Minimal config to test priority: error vs missing_gr_nbr
const config = {
  version: 5, enabled: true, objectType: "MMInvoice", expressionLanguage: "validation-expr-v1",
  ruleSets: [{
    ruleSetCode: "RS_TEST", ruleSetName: "Test", active: true,
    validationRunScope: ["Extracted","Mismatch","Verified","MissingGRNbr"],
    statusChangeScope: ["Extracted","Mismatch","Verified","MissingGRNbr"],
    outcomePolicy: {
      aggregation: "highestSeverityWins" as const,
      outcomes: [
        { code: "pass", label: "Passed", severity: "success", blocking: false, status: { change: true, target: "Verified" } },
        { code: "warning", label: "Warning", severity: "warning", blocking: false, status: { change: true, target: "Verified" } },
        { code: "error", label: "Error", severity: "error", blocking: false, status: { change: true, target: "Mismatch" } },
        { code: "empty_items", label: "No Items", severity: "error", blocking: true, status: { change: true, target: "Mismatch" } },
        { code: "amount_not_balance", label: "Diff Amount", severity: "error", blocking: true, status: { change: true, target: "Mismatch" } },
        { code: "missing_gr_nbr", label: "Missing GR", severity: "error", blocking: true, status: { change: true, target: "MissingGRNbr" } },
      ]
    },
    functions: [
      // Qty error rule (produces "error" outcome)
      {
        functionCode: "FN_QTY", functionName: "Qty Check", active: true, runOn: "itemTable",
        context: { invQuantity: { source: "field", path: "invQuantity", dataType: "number" }, openQty: { source: "field", path: "openQuantityForInvoice", dataType: "number" } },
        derived: { delta: { expression: "invQuantity - openQty" } },
        decisionTable: { tableCode: "DT", rows: [
          { priority: 1, when: "delta > 0", ruleCode: "QTY_OVER", outcome: "error", ui: { showTag: { enabled: true, label: "Qty Over" } } },
          { priority: 2, when: "true", ruleCode: "QTY_OK", outcome: "pass", ui: { showTag: { enabled: false } } },
        ]}
      },
      // GR Nbr presence rule (produces "missing_gr_nbr" outcome)
      {
        functionCode: "FN_GR", functionName: "GR Check", active: true, runOn: "itemTable",
        context: { poGRBasedIV: { source: "field", path: "poGRBasedIV", dataType: "boolean" }, grDoc: { source: "field", path: "grDoc", dataType: "string" } },
        derived: { grDocBlank: { expression: "grDoc == null || grDoc == ''" } },
        decisionTable: { tableCode: "DT2", rows: [
          { priority: 1, when: "poGRBasedIV == true && grDocBlank", ruleCode: "MISSING_GR", outcome: "missing_gr_nbr", ui: { showTag: { enabled: true, label: "Missing GR" } } },
          { priority: 2, when: "true", ruleCode: "GR_OK", outcome: "pass", ui: { showTag: { enabled: false } } },
        ]}
      },
    ]
  }]
};

// Case 1: ONLY Qty error (no GR issue) → should be "Mismatch"
console.log("=== Case 1: Only Qty Over error ===");
const data1 = { items: [
  { invQuantity: 100, openQuantityForInvoice: 50, poGRBasedIV: true, grDoc: "5000044560" },
]};
const r1 = evaluateValidationConfigV5(config as any, data1, { currentStatus: "Verified" });
console.log(`Outcome: ${r1.outcome} | Status: ${r1.recommendedDocumentStatus}`);

// Case 2: ONLY Missing GR (no Qty issue) → should be "MissingGRNbr"
console.log("\n=== Case 2: Only Missing GR ===");
const data2 = { items: [
  { invQuantity: 1, openQuantityForInvoice: 1, poGRBasedIV: true, grDoc: "" },
]};
const r2 = evaluateValidationConfigV5(config as any, data2, { currentStatus: "Verified" });
console.log(`Outcome: ${r2.outcome} | Status: ${r2.recommendedDocumentStatus}`);

// Case 3: BOTH Qty error AND Missing GR → should be "MissingGRNbr" (higher priority)
console.log("\n=== Case 3: Both Qty Over + Missing GR ===");
const data3 = { items: [
  { invQuantity: 100, openQuantityForInvoice: 50, poGRBasedIV: true, grDoc: "" },
]};
const r3 = evaluateValidationConfigV5(config as any, data3, { currentStatus: "Verified" });
console.log(`Outcome: ${r3.outcome} | Status: ${r3.recommendedDocumentStatus}`);

// Case 4: Mixed items - one with Qty error, another with Missing GR
console.log("\n=== Case 4: Item0=Qty Over, Item1=Missing GR ===");
const data4 = { items: [
  { invQuantity: 100, openQuantityForInvoice: 50, poGRBasedIV: true, grDoc: "5000044560" },
  { invQuantity: 1, openQuantityForInvoice: 1, poGRBasedIV: true, grDoc: "" },
]};
const r4 = evaluateValidationConfigV5(config as any, data4, { currentStatus: "Verified" });
console.log(`Outcome: ${r4.outcome} | Status: ${r4.recommendedDocumentStatus}`);
for (const ir of r4.itemResults) {
  console.log(`  Item ${ir.itemIndex}: outcome=${ir.outcome}, severity=${ir.severity}`);
}
