import { StepCompleteOutcome } from '../eightDAnalyzer';

describe('Progressive Step Analyzer Types & Callback Integration', () => {
    it('supports step complete callback signature', async () => {
        const receivedSteps: string[] = [];
        const mockCallback = async (outcome: StepCompleteOutcome) => {
            receivedSteps.push(outcome.discipline.code);
        };

        const dummyOutcome: StepCompleteOutcome = {
            discipline: {
                code: 'D1',
                sequence: 1,
                title: 'Establish the Team',
                summary: 'Team set up',
                content: 'D1 content',
                actionItems: [],
                sources: ['team'],
                confidence: 0.9,
                dataBacked: true,
                data: {},
            },
            context: {} as any,
            independent: {} as any,
            precedents: {} as any,
        };

        await mockCallback(dummyOutcome);
        expect(receivedSteps).toEqual(['D1']);
    });
});
