import { evaluateValidationConfigV5 } from './index';

const config = {
    version: 5,
    enabled: true,
    ruleSets: [
        {
            ruleSetName: "Test",
            outcomePolicy: {
                aggregation: "highestSeverityWins",
                outcomes: [
                    { code: "pass", severity: "success", blocking: false },
                    { code: "error", severity: "error", blocking: true }
                ]
            },
            functions: [
                {
                    functionCode: "FN1",
                    functionName: "Test 1",
                    runOn: "header",
                    active: true,
                    context: {
                        "paymentTerms": { path: "paymentTerms" },
                        "poPaymentTerm": { path: "items[0].poPaymentTerm" }
                    },
                    decisionTable: {
                        rows: [
                            { priority: 1, when: "paymentTerms == poPaymentTerm", outcome: "pass", ruleCode: "MATCH" },
                            { priority: 2, outcome: "error", ruleCode: "MISMATCH" }
                        ]
                    }
                }
            ]
        }
    ]
};

const data = {
    paymentTerms: { value: "NT30" },
    items: [
        { poPaymentTerm: { value: "NT30" } }
    ]
};

const result = evaluateValidationConfigV5(config as any, data);
console.log(JSON.stringify(result.ruleSets[0].functionResults, null, 2));
