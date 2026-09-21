import {
    checkFieldConfirmation,
    getRequiredConfirmFields,
    isExcludedDisciplineField,
    parseConfirmedFields,
} from '../fieldConfirm';

describe('fieldConfirm domain module', () => {
    describe('parseConfirmedFields', () => {
        it('returns empty array on null, empty string, or invalid JSON', () => {
            expect(parseConfirmedFields(null)).toEqual([]);
            expect(parseConfirmedFields('')).toEqual([]);
            expect(parseConfirmedFields('not a json')).toEqual([]);
            expect(parseConfirmedFields('{}')).toEqual([]);
        });

        it('parses valid string array JSON correctly', () => {
            const json = JSON.stringify(['problem.statement', 'problem.what', 'problem.where']);
            expect(parseConfirmedFields(json)).toEqual(['problem.statement', 'problem.what', 'problem.where']);
        });
    });

    describe('getRequiredConfirmFields', () => {
        it('returns empty array when formSchemaJson is empty', () => {
            expect(getRequiredConfirmFields(null, 'D2')).toEqual([]);
        });

        it('extracts visible confirmable fields from layout groups and excludes non-confirmable widgets', () => {
            const schema = {
                fields: [
                    { key: 'problem.statement', label: 'Problem Statement', widget: 'problem-statement' },
                    { key: 'problem.what', label: 'What', widget: 'w2h-cell' },
                    { key: 'problem.complaintReference', label: 'Complaint', widget: 'complaint-reference' }, // Non-confirmable
                    { key: 'sources', label: 'Sources', widget: 'evidence-list' }, // Excluded in D2? No, D3-D8
                    { key: 'hidden.field', label: 'Hidden', widget: 'text', visible: false },
                ],
                groups: [
                    { id: 'g1', fieldKeys: ['problem.complaintReference', 'problem.statement', 'problem.what', 'hidden.field'] },
                ],
            };

            const fields = getRequiredConfirmFields(JSON.stringify(schema), 'D2');
            expect(fields).toEqual(['problem.statement', 'problem.what']);
            expect(fields).not.toContain('problem.complaintReference');
            expect(fields).not.toContain('hidden.field');
        });

        it('excludes discipline-specific excluded fields (e.g. gaps, sources in D3)', () => {
            const schema = {
                fields: [
                    { key: 'containment.actions', label: 'Actions', widget: 'action-cards' },
                    { key: 'containment.gaps', label: 'Open containment gaps', widget: 'warning-list' },
                    { key: 'sources', label: 'Sources', widget: 'evidence-list' },
                ],
                groups: [
                    { id: 'g1', fieldKeys: ['containment.actions', 'containment.gaps', 'sources'] },
                ],
            };

            const fields = getRequiredConfirmFields(JSON.stringify(schema), 'D3');
            expect(fields).toEqual(['containment.actions']);
        });
    });

    describe('checkFieldConfirmation', () => {
        it('identifies unconfirmed fields and calculates completion status', () => {
            const required = ['f1', 'f2', 'f3'];
            const confirmed = ['f1', 'f3'];

            const result = checkFieldConfirmation(required, confirmed);
            expect(result.allConfirmed).toBe(false);
            expect(result.missingKeys).toEqual(['f2']);
            expect(result.confirmedCount).toBe(2);
            expect(result.totalRequired).toBe(3);
        });

        it('returns allConfirmed true when all required fields are confirmed', () => {
            const required = ['f1', 'f2'];
            const confirmed = ['f1', 'f2', 'f_extra'];

            const result = checkFieldConfirmation(required, confirmed);
            expect(result.allConfirmed).toBe(true);
            expect(result.missingKeys).toEqual([]);
            expect(result.confirmedCount).toBe(2);
            expect(result.totalRequired).toBe(2);
        });
    });
});
