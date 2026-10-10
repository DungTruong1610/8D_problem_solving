import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { eightDService, type Report8D } from '@/services/eightd-service';
import { BENCHMARK_NOTIFICATION_ID } from '@/pages/guide/guide-data';
import { TOUR_CHAPTERS, TOUR_STEPS } from './walkthrough-steps';
import { WalkthroughOverlay } from './walkthrough-overlay';
import type { TourCaseRef, TourControlKey, TourControls, TourPage, TourStep } from './walkthrough-types';

/**
 * Guided Tour — trạng thái và điều hướng.
 *
 * Provider giữ "đang ở bước nào"; mỗi bước tự nói nó cần trang nào và trang đó ở
 * trạng thái nào. Provider đưa người dùng tới đúng route, còn các trang đọc phần
 * trạng thái của mình qua `useTourControl`. Lớp phủ (spotlight + popover) là
 * việc của `WalkthroughOverlay`.
 */

const PAGE_PATHS: Record<Exclude<TourPage, 'caseDetail'>, string> = {
    worklist: '/8d',
    masterData: '/master-data',
    aiConfig: '/workflow',
};

interface TourContextValue {
    active: boolean;
    step: TourStep | null;
    start: () => void;
    stop: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

/**
 * Case mà chương "Working a case" mở.
 *
 * Ưu tiên case mẫu của đề bài (cùng case mà banner "Open sample case" mở), rồi
 * tới case đầu tiên đang mở. Case đang `Analyzing` / `Failed` không có đủ tám
 * bước để chỉ vào, nên bị loại. Case đã đóng chỉ là đường lui cuối: mọi bước của
 * nó đã duyệt nên nút đổi trạng thái không còn để giới thiệu.
 */
async function pickTourCase(): Promise<TourCaseRef | null> {
    const rows: Report8D[] = (await eightDService.list()).value ?? [];
    const usable = rows.filter((r) => r.status !== 'Analyzing' && r.status !== 'Failed');
    const open = usable.filter((r) => r.status !== 'Closed');
    const pick = open.find((r) => r.notificationId === BENCHMARK_NOTIFICATION_ID) ?? open[0] ?? usable[0];
    return pick ? { id: pick.ID, notificationId: pick.notificationId } : null;
}

function pathFor(page: TourPage, caseRef: TourCaseRef | null): string | null {
    if (page === 'caseDetail') return caseRef ? `/8d/${caseRef.id}` : null;
    return PAGE_PATHS[page];
}

export function WalkthroughProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [active, setActive] = useState(false);
    const [index, setIndex] = useState(0);
    const [caseRef, setCaseRef] = useState<TourCaseRef | null>(null);
    const [resolvingCase, setResolvingCase] = useState(false);
    /** Lượt tìm case dùng chung giữa lúc bắt đầu tour và lúc tới chương case. */
    const casePromiseRef = useRef<Promise<TourCaseRef | null> | null>(null);
    /** Hướng đi gần nhất — bỏ qua bước thiếu phần tử thì đi tiếp đúng hướng đó. */
    const directionRef = useRef<1 | -1>(1);

    const step = active ? TOUR_STEPS[index] ?? null : null;

    const stop = useCallback(() => {
        setActive(false);
        setIndex(0);
        setResolvingCase(false);
        casePromiseRef.current = null;
    }, []);

    const start = useCallback(() => {
        // Tìm case ngay từ đầu, ở nền: tới chương cuối thì đã có sẵn, không bắt
        // người dùng chờ một lượt gọi mạng giữa tour.
        casePromiseRef.current = pickTourCase().catch(() => null);
        void casePromiseRef.current.then(setCaseRef);
        setCaseRef(null);
        directionRef.current = 1;
        setIndex(0);
        setActive(true);
    }, []);

    const goTo = useCallback(async (next: number, direction: 1 | -1) => {
        if (next < 0) return;
        if (next >= TOUR_STEPS.length) {
            stop();
            return;
        }

        let target = next;
        if (TOUR_STEPS[target].page === 'caseDetail') {
            setResolvingCase(true);
            const found = await (casePromiseRef.current ?? Promise.resolve(null));
            setResolvingCase(false);
            setCaseRef(found);
            if (!found) {
                // Không có case nào để mở: nhảy qua cả chương, theo hướng đang đi.
                while (target >= 0 && target < TOUR_STEPS.length && TOUR_STEPS[target].page === 'caseDetail') {
                    target += direction;
                }
                if (target < 0) return;
                if (target >= TOUR_STEPS.length) {
                    stop();
                    return;
                }
            }
        }

        directionRef.current = direction;
        setIndex(target);
    }, [stop]);

    const next = useCallback(() => void goTo(index + 1, 1), [goTo, index]);
    const back = useCallback(() => void goTo(index - 1, -1), [goTo, index]);
    const skipMissing = useCallback(() => void goTo(index + directionRef.current, directionRef.current), [goTo, index]);

    // Đưa người dùng tới trang của bước. Bước không khai báo trang thì đứng yên.
    const targetPath = step?.page ? pathFor(step.page, caseRef) : null;
    useEffect(() => {
        if (targetPath && pathname !== targetPath) navigate(targetPath);
    }, [targetPath, pathname, navigate]);

    const value = useMemo<TourContextValue>(() => ({ active, step, start, stop }), [active, step, start, stop]);

    return (
        <TourContext.Provider value={value}>
            {children}
            {step && (
                <WalkthroughOverlay
                    step={step}
                    stepNumber={index + 1}
                    total={TOUR_STEPS.length}
                    chapterLabel={TOUR_CHAPTERS[step.chapter]}
                    caseLabel={caseRef?.notificationId ?? 'this case'}
                    busy={resolvingCase || (targetPath !== null && pathname !== targetPath)}
                    onNext={next}
                    onBack={back}
                    onClose={stop}
                    onTargetMissing={skipMissing}
                />
            )}
        </TourContext.Provider>
    );
}

function useTourContext(): TourContextValue {
    const ctx = useContext(TourContext);
    if (!ctx) throw new Error('Guided Tour hooks must be used inside <WalkthroughProvider>.');
    return ctx;
}

/** Bắt đầu / dừng tour, và tour có đang chạy không. */
export function useWalkthrough(): Pick<TourContextValue, 'active' | 'start' | 'stop'> {
    const { active, start, stop } = useTourContext();
    return { active, start, stop };
}

interface TourControlOptions {
    /**
     * Chạy đúng một lần khi tour THÔI yêu cầu `key` (sang bước không nhắc tới nó,
     * hoặc tour kết thúc) — để đóng thứ tour đã mở, như dialog Create 8D Report.
     */
    release?: () => void;
    /** `false`: chưa áp dụng được (dữ liệu chưa về) — chờ, rồi áp dụng khi thành `true`. */
    ready?: boolean;
}

/**
 * Cho tour điều khiển một mẩu trạng thái của trang.
 *
 * `apply` chạy mỗi khi bước hiện tại yêu cầu một giá trị cho `key`. Khi tour
 * không chạy, hook không làm gì: trạng thái vẫn hoàn toàn của trang.
 */
export function useTourControl<K extends TourControlKey>(
    key: K,
    apply: (value: TourControls[K]) => void,
    { release, ready = true }: TourControlOptions = {},
): void {
    const { active, step } = useTourContext();
    const requested = active ? step?.controls?.[key] : undefined;

    const applyRef = useRef(apply);
    const releaseRef = useRef(release);
    useLayoutEffect(() => {
        applyRef.current = apply;
        releaseRef.current = release;
    });

    const appliedRef = useRef(false);
    useEffect(() => {
        if (requested !== undefined) {
            if (!ready) return;
            applyRef.current(requested as TourControls[K]);
            appliedRef.current = true;
        } else if (appliedRef.current) {
            appliedRef.current = false;
            releaseRef.current?.();
        }
    }, [requested, ready]);
}
