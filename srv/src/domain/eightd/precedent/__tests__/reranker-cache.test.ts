jest.mock('../../../../core/ai/llmClient', () => ({
    complete: jest.fn(),
}));

import { complete } from '../../../../core/ai/llmClient';
import { clearRerankCache, rerankCandidates, type RerankFrame } from '../reranker';

const completeMock = complete as jest.MockedFunction<typeof complete>;

const frame: RerankFrame = {
    queryFrame: 'Identify the physical failure mechanism.',
    candidateFrame: 'Compare the candidate mechanism.',
    rubric: '100 means same mechanism; 0 means unrelated.',
};

const candidate = {
    notificationId: '8D-1001',
    symptomShortText: 'Burr on flange',
    searchText: 'Tool wear caused a burr on the flange.',
};

describe('rerank response cache', () => {
    beforeEach(() => {
        clearRerankCache();
        completeMock.mockReset();
        completeMock.mockResolvedValue({
            content: JSON.stringify({
                queryAnalysis: 'Tool wear caused the burr.',
                rankings: [{
                    notificationId: '8D-1001', score: 88,
                    reason: 'Same tool wear mechanism.', analysis: 'Both describe insert wear.',
                }],
            }),
            finishReason: 'stop',
        } as Awaited<ReturnType<typeof complete>>);
    });

    it('reuses a complete result for identical content and returns a defensive copy', async () => {
        const first = await rerankCandidates(frame, 'Open case text', [candidate]);
        first.get('8D-1001')!.score = 0;

        const second = await rerankCandidates(frame, 'Open case text', [candidate]);

        expect(completeMock).toHaveBeenCalledTimes(1);
        expect(second.get('8D-1001')?.score).toBe(88);
    });

    it('deduplicates simultaneous requests for identical content', async () => {
        await Promise.all([
            rerankCandidates(frame, 'Open case text', [candidate]),
            rerankCandidates(frame, 'Open case text', [candidate]),
        ]);

        expect(completeMock).toHaveBeenCalledTimes(1);
    });

    it('does not reuse judgments when query, frame, or candidate content changes', async () => {
        await rerankCandidates(frame, 'Open case text', [candidate]);
        await rerankCandidates(frame, 'Different query', [candidate]);
        await rerankCandidates({ ...frame, rubric: 'Different rubric.' }, 'Open case text', [candidate]);
        await rerankCandidates(frame, 'Open case text', [{ ...candidate, searchText: 'Different cause.' }]);

        expect(completeMock).toHaveBeenCalledTimes(4);
    });
});
