import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button, Spinner, cn } from '@cnma/react-ui';
import {
    clipToViewport,
    findScrollParent,
    padBox,
    placePopover,
    scrollIntoComfortView,
    type Box,
    type PopoverPosition,
} from './placement';
import type { TourStep } from './walkthrough-types';

/**
 * Lớp phủ của Guided Tour: nền tối có lỗ khoét quanh phần tử, viền sáng, và
 * popover giải thích.
 *
 * ── Vì sao đo lại ở MỖI khung hình ──
 * Phần tử được chỉ vào thay đổi vị trí vì đủ thứ lý do tour không được báo:
 * dữ liệu về muộn đẩy layout xuống, dialog đang chạy hiệu ứng mở, trang đang
 * cuộn mượt, người dùng đổi zoom hay kích thước cửa sổ. Một vòng
 * `requestAnimationFrame` đọc lại `getBoundingClientRect` là cách duy nhất bám
 * đúng cả mấy trường hợp đó — và chỉ setState khi số liệu thật sự đổi.
 *
 * ── Vì sao chặn `pointerdown` ở gốc ──
 * Khi một Radix Dialog đang mở (Create 8D Report), mọi cú nhấn ngoài dialog bị
 * coi là "bấm ra ngoài" và đóng dialog. Popover của tour nằm ngoài dialog, nên
 * bấm Next sẽ đóng đúng cái dialog tour đang giới thiệu. Dừng lan truyền ở gốc
 * lớp phủ khiến listener của Radix trên `document` không bao giờ nghe thấy.
 */

type Phase = 'pending' | 'loading' | 'found' | 'missing';

interface Layout {
    phase: Phase;
    spotlight: Box | null;
    popover: PopoverPosition | null;
}

/** Chưa thấy phần tử sau chừng này thì mới hiện "đang tải" — tránh nháy. */
const LOADING_AFTER_MS = 450;
/** Bước bắt buộc: chờ trang tải tối đa chừng này rồi hiện popover giữa màn hình. */
const REQUIRED_TIMEOUT_MS = 10_000;
/** Bước tuỳ chọn: phần tử vắng mặt quá chừng này thì bỏ qua bước. */
const OPTIONAL_TIMEOUT_MS = 2_500;
const DEFAULT_PADDING = 6;
const POPOVER_FALLBACK_SIZE = { width: 360, height: 220 };

/** Phần tử đầu tiên khớp selector mà thật sự đang hiển thị. */
function findVisibleTarget(selector: string): HTMLElement | null {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
    }
    return null;
}

function layoutKey(layout: Layout): string {
    const round = (n: number) => Math.round(n * 2) / 2;
    const s = layout.spotlight;
    const p = layout.popover;
    return [
        layout.phase,
        s ? [s.top, s.left, s.width, s.height].map(round).join(',') : '-',
        p ? [p.top, p.left, p.side, p.arrow ?? '-'].map((v) => (typeof v === 'number' ? round(v) : v)).join(',') : '-',
    ].join('|');
}

/** `**đậm**` → <strong>; còn lại giữ nguyên chữ. */
function renderRich(text: string): ReactNode {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
            : <Fragment key={i}>{part}</Fragment>,
    );
}

function isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

interface WalkthroughOverlayProps {
    step: TourStep;
    stepNumber: number;
    total: number;
    chapterLabel: string;
    caseLabel: string;
    busy: boolean;
    onNext: () => void;
    onBack: () => void;
    onClose: () => void;
    onTargetMissing: () => void;
}

export function WalkthroughOverlay({
    step,
    stepNumber,
    total,
    chapterLabel,
    caseLabel,
    busy,
    onNext,
    onBack,
    onClose,
    onTargetMissing,
}: WalkthroughOverlayProps) {
    // `useId` có ký tự không hợp lệ trong `url(#…)` của SVG — lọc bỏ.
    const maskId = `tour-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const titleId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const targetRef = useRef<HTMLElement | null>(null);
    const [layout, setLayout] = useState<Layout>({ phase: 'pending', spotlight: null, popover: null });

    const handlersRef = useRef({ onNext, onBack, onClose, onTargetMissing, busy });
    useLayoutEffect(() => {
        handlersRef.current = { onNext, onBack, onClose, onTargetMissing, busy };
    });

    // ── Bám phần tử theo từng khung hình ──
    useEffect(() => {
        const startedAt = performance.now();
        let frame = 0;
        let lastKey = '';
        let scrolled = false;
        let reportedMissing = false;
        targetRef.current = null;

        const tick = () => {
            const viewport = { width: window.innerWidth, height: window.innerHeight };
            const elapsed = performance.now() - startedAt;
            const el = step.target ? findVisibleTarget(step.target) : null;
            targetRef.current = el;

            let phase: Phase;
            let spotlight: Box | null = null;
            if (!step.target) {
                phase = 'found';
            } else if (el) {
                if (!scrolled) {
                    scrollIntoComfortView(el);
                    scrolled = true;
                }
                phase = 'found';
                spotlight = padBox(el.getBoundingClientRect(), step.padding ?? DEFAULT_PADDING);
            } else if (elapsed > (step.optional ? OPTIONAL_TIMEOUT_MS : REQUIRED_TIMEOUT_MS)) {
                phase = 'missing';
            } else {
                phase = elapsed > LOADING_AFTER_MS ? 'loading' : 'pending';
            }

            if (phase === 'missing' && step.optional) {
                if (!reportedMissing) {
                    reportedMissing = true;
                    handlersRef.current.onTargetMissing();
                }
                return;
            }

            const pop = popoverRef.current;
            const size = pop ? { width: pop.offsetWidth, height: pop.offsetHeight } : POPOVER_FALLBACK_SIZE;
            const visible = spotlight ? clipToViewport(spotlight, viewport) : null;
            // Có `anchor` (ví dụ cả dialog) thì đứng cạnh nó, nhưng mũi tên vẫn chỉ về phần tử.
            const anchorEl = visible && step.anchor ? findVisibleTarget(step.anchor) : null;
            const anchor = anchorEl ? clipToViewport(anchorEl.getBoundingClientRect(), viewport) : visible;
            const popover = placePopover(anchor, size, viewport, step.side, visible);

            const next: Layout = { phase, spotlight, popover };
            const key = layoutKey(next);
            if (key !== lastKey) {
                lastKey = key;
                setLayout(next);
            }
            frame = requestAnimationFrame(tick);
        };

        setLayout({ phase: 'pending', spotlight: null, popover: null });
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [step]);

    // ── Bàn phím ──
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const h = handlersRef.current;
            if (e.key === 'Escape') {
                h.onClose();
                return;
            }
            // Đang gõ trong một ô nhập (ví dụ ô tìm kiếm trong dialog) thì mũi tên
            // là để di con trỏ, không phải để chuyển bước.
            if (isEditable(e.target) || h.busy) return;
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                h.onNext();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                h.onBack();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    // ── Chặn "bấm ra ngoài" của Radix Dialog (xem chú thích đầu file) ──
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const stop = (e: Event) => e.stopPropagation();
        root.addEventListener('pointerdown', stop);
        root.addEventListener('mousedown', stop);
        root.addEventListener('focusin', stop);
        return () => {
            root.removeEventListener('pointerdown', stop);
            root.removeEventListener('mousedown', stop);
            root.removeEventListener('focusin', stop);
        };
    }, []);

    /** Lăn chuột trên nền tối vẫn cuộn trang bên dưới — chỉ là không bấm được. */
    const forwardWheel = (e: React.WheelEvent) => {
        const el = targetRef.current;
        const container = (el && findScrollParent(el)) ?? document.getElementById('main-scroll-container');
        container?.scrollBy({ top: e.deltaY, left: e.deltaX });
    };

    const { phase, spotlight, popover } = layout;
    const isFirst = stepNumber === 1;
    const isLast = stepNumber === total;
    const showPopover = phase !== 'pending' && popover !== null;
    const body = step.body.split('{case}').join(caseLabel);

    return createPortal(
        <div
            ref={rootRef}
            className="fixed inset-0 z-[1000]"
            style={{ pointerEvents: 'none' }}
            // Trạng thái đọc được từ ngoài — cho kiểm thử E2E, không cho logic.
            data-walkthrough-step={step.id}
            data-walkthrough-phase={phase}
        >
            {/* Nền tối, khoét lỗ quanh phần tử. Chặn mọi cú bấm vào trang bên dưới. */}
            <svg
                className="absolute inset-0 h-full w-full"
                style={{ pointerEvents: 'auto' }}
                onWheel={forwardWheel}
                aria-hidden="true"
            >
                <defs>
                    <mask id={maskId}>
                        <rect width="100%" height="100%" fill="white" />
                        {spotlight && (
                            <rect
                                x={spotlight.left}
                                y={spotlight.top}
                                width={spotlight.width}
                                height={spotlight.height}
                                rx={10}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgb(15 23 42 / 0.55)" mask={`url(#${maskId})`} />
            </svg>

            {spotlight && (
                <div
                    data-walkthrough="spotlight"
                    className="absolute rounded-[10px] ring-2 ring-primary shadow-[0_0_0_6px_rgb(255_255_255/0.18)] transition-opacity"
                    style={{
                        top: spotlight.top,
                        left: spotlight.left,
                        width: spotlight.width,
                        height: spotlight.height,
                        pointerEvents: 'none',
                    }}
                    aria-hidden="true"
                />
            )}

            <div
                ref={popoverRef}
                data-walkthrough="popover"
                role="dialog"
                aria-modal="false"
                aria-labelledby={titleId}
                className={cn(
                    'absolute max-w-[calc(100vw-24px)] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl transition-opacity duration-150',
                    step.wide ? 'w-[440px]' : 'w-[360px]',
                    showPopover ? 'opacity-100' : 'opacity-0',
                )}
                style={{
                    top: popover?.top ?? 0,
                    left: popover?.left ?? 0,
                    pointerEvents: showPopover ? 'auto' : 'none',
                }}
            >
                {popover?.side && popover.arrow !== null && <PopoverArrow side={popover.side} offset={popover.arrow} />}

                <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {chapterLabel}
                        <span className="ml-1.5 font-medium normal-case tracking-normal text-muted-foreground tabular-nums">
                            · Step {stepNumber} of {total}
                        </span>
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close tour"
                        title="Close tour (Esc)"
                        className="-mr-1 -mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-2 px-4 pb-3.5 pt-1.5">
                    <h2 id={titleId} className="text-base font-semibold leading-snug text-foreground">
                        {step.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{renderRich(body)}</p>
                    {step.bullets && (
                        <ul className="space-y-1.5 text-sm leading-snug text-muted-foreground">
                            {step.bullets.map((b) => (
                                <li key={b} className="flex gap-2">
                                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />
                                    <span>{renderRich(b)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {phase === 'loading' && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Spinner className="h-3.5 w-3.5" />
                            Waiting for this screen to load…
                        </p>
                    )}
                    {phase === 'missing' && (
                        <p className="text-xs text-warning">
                            This part of the screen isn't showing right now. The description still applies.
                        </p>
                    )}
                </div>

                <div className="h-1 w-full bg-muted">
                    <div
                        className="h-full bg-primary transition-[width] duration-300"
                        style={{ width: `${(stepNumber / total) * 100}%` }}
                    />
                </div>

                <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    >
                        {isLast ? 'Close' : 'Skip tour'}
                    </button>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={isFirst || busy} onClick={onBack} className="gap-1">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back
                        </Button>
                        <Button type="button" size="sm" disabled={busy} onClick={onNext} className="gap-1">
                            {busy && <Spinner className="h-3.5 w-3.5" />}
                            {isLast ? 'Finish' : 'Next'}
                            {!isLast && !busy && <ArrowRight className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** Mũi tên nhỏ chỉ từ popover về phía phần tử. */
function PopoverArrow({ side, offset }: { side: NonNullable<PopoverPosition['side']>; offset: number }) {
    // Popover nằm DƯỚI phần tử thì mũi tên ở cạnh TRÊN của popover, v.v.
    const edge = { bottom: 'top', top: 'bottom', right: 'left', left: 'right' }[side] as 'top' | 'bottom' | 'left' | 'right';
    const vertical = edge === 'top' || edge === 'bottom';
    const borders = {
        top: 'border-l border-t',
        bottom: 'border-r border-b',
        left: 'border-l border-b',
        right: 'border-r border-t',
    }[edge];
    return (
        <span
            aria-hidden="true"
            className={cn('absolute h-3 w-3 rotate-45 border-border bg-popover', borders)}
            style={{
                [edge]: -6,
                ...(vertical ? { left: offset - 6 } : { top: offset - 6 }),
            }}
        />
    );
}
