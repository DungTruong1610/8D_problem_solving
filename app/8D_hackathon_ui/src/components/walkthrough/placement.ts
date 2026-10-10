import type { TourSide } from './walkthrough-types';

/**
 * Hình học của tour: vùng chiếu sáng, chỗ đặt popover, và cuộn phần tử vào tầm
 * nhìn. Hàm thuần (trừ `scrollIntoComfortView`) để kiểm được bằng tay.
 *
 * Mọi toạ độ là CSS px của viewport — đúng thứ `getBoundingClientRect` trả về.
 * Nhờ vậy tour khớp ở mọi mức zoom của trình duyệt (90%, 100%, 125%…): zoom đổi
 * kích thước viewport tính bằng CSS px, còn phép tính ở đây đọc lại viewport ở
 * từng khung hình nên không giả định một kích thước cố định nào.
 */

export interface Box {
    top: number;
    left: number;
    width: number;
    height: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface PopoverPosition {
    top: number;
    left: number;
    /** Popover nằm ở phía nào của phần tử; null = giữa màn hình hoặc đè lên phần tử. */
    side: TourSide | null;
    /** Vị trí mũi tên dọc theo cạnh popover, px; null = không vẽ mũi tên. */
    arrow: number | null;
}

/** Khoảng cách popover ↔ phần tử. */
const GAP = 14;
/** Khoảng cách tối thiểu tới mép viewport. */
const EDGE = 12;
/** Mũi tên không được sát góc bo của popover. */
const ARROW_INSET = 18;

const FALLBACK_ORDER: TourSide[] = ['bottom', 'right', 'left', 'top'];

function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}

export function padBox(box: Box, padding: number): Box {
    return {
        top: box.top - padding,
        left: box.left - padding,
        width: box.width + padding * 2,
        height: box.height + padding * 2,
    };
}

/** Phần nhìn thấy được của phần tử; null nếu nằm hẳn ngoài viewport. */
export function clipToViewport(box: Box, viewport: Size): Box | null {
    const top = Math.max(box.top, 0);
    const left = Math.max(box.left, 0);
    const bottom = Math.min(box.top + box.height, viewport.height);
    const right = Math.min(box.left + box.width, viewport.width);
    if (bottom <= top || right <= left) return null;
    return { top, left, width: right - left, height: bottom - top };
}

function roomOn(side: TourSide, target: Box, viewport: Size): number {
    switch (side) {
        case 'top': return target.top - GAP - EDGE;
        case 'bottom': return viewport.height - (target.top + target.height) - GAP - EDGE;
        case 'left': return target.left - GAP - EDGE;
        case 'right': return viewport.width - (target.left + target.width) - GAP - EDGE;
    }
}

function fits(side: TourSide, target: Box, popover: Size, viewport: Size): boolean {
    const room = roomOn(side, target, viewport);
    return side === 'top' || side === 'bottom' ? room >= popover.height : room >= popover.width;
}

/**
 * Vị trí mũi tên dọc theo cạnh popover, chỉ về tâm của `pointTo`. Tâm nằm ngoài
 * tầm cạnh đó (popover đặt cạnh dialog, nút ở tít góc kia) thì không vẽ.
 */
function arrowToward(start: number, length: number, center: number): number | null {
    const offset = center - start;
    if (offset < ARROW_INSET || offset > length - ARROW_INSET) return null;
    return offset;
}

function positionOn(side: TourSide, target: Box, popover: Size, viewport: Size, pointTo: Box): PopoverPosition {
    if (side === 'top' || side === 'bottom') {
        const left = clamp(target.left + target.width / 2 - popover.width / 2, EDGE, viewport.width - popover.width - EDGE);
        const top = clamp(
            side === 'bottom' ? target.top + target.height + GAP : target.top - GAP - popover.height,
            EDGE,
            viewport.height - popover.height - EDGE,
        );
        return { top, left, side, arrow: arrowToward(left, popover.width, pointTo.left + pointTo.width / 2) };
    }
    const top = clamp(target.top + target.height / 2 - popover.height / 2, EDGE, viewport.height - popover.height - EDGE);
    const left = clamp(
        side === 'right' ? target.left + target.width + GAP : target.left - GAP - popover.width,
        EDGE,
        viewport.width - popover.width - EDGE,
    );
    return { top, left, side, arrow: arrowToward(top, popover.height, pointTo.top + pointTo.height / 2) };
}

/** Thiếu bao nhiêu px để popover đứng vừa ở phía đó (âm = dư chỗ). */
function shortfall(side: TourSide, target: Box, popover: Size, viewport: Size): number {
    const need = side === 'top' || side === 'bottom' ? popover.height : popover.width;
    return need - roomOn(side, target, viewport);
}

/**
 * Chọn chỗ đặt popover.
 *
 * Thử phía ưu tiên trước, rồi dưới → phải → trái → trên. Không phía nào đủ chỗ:
 *  - phần tử LỚN (chiếm phần đáng kể màn hình, ví dụ cả một bảng): đặt popover
 *    đè lên góc dưới-phải phần nhìn thấy của nó, không mũi tên;
 *  - phần tử nhỏ: đứng ở phía thiếu chỗ ít nhất, ép vào trong viewport — đè lên
 *    phần tử ít nhất có thể.
 *
 * `target` là phần ĐÃ CẮT theo viewport: căn theo phần người dùng đang nhìn
 * thấy, không theo nửa bảng nằm khuất bên dưới. `pointTo` là thứ mũi tên chỉ
 * vào — mặc định chính là `target`.
 */
export function placePopover(
    target: Box | null,
    popover: Size,
    viewport: Size,
    preferred?: TourSide,
    pointTo?: Box | null,
): PopoverPosition {
    if (!target) {
        return {
            top: clamp((viewport.height - popover.height) / 2, EDGE, viewport.height - popover.height - EDGE),
            left: clamp((viewport.width - popover.width) / 2, EDGE, viewport.width - popover.width - EDGE),
            side: null,
            arrow: null,
        };
    }

    const arrowTarget = pointTo ?? target;
    const order = preferred ? [preferred, ...FALLBACK_ORDER.filter((s) => s !== preferred)] : FALLBACK_ORDER;
    const side = order.find((s) => fits(s, target, popover, viewport));
    if (side) return positionOn(side, target, popover, viewport, arrowTarget);

    const isLarge = target.width * target.height > viewport.width * viewport.height * 0.3;
    if (!isLarge) {
        const best = [...order].sort(
            (a, b) => shortfall(a, target, popover, viewport) - shortfall(b, target, popover, viewport),
        )[0];
        return { ...positionOn(best, target, popover, viewport, arrowTarget), arrow: null };
    }

    return {
        top: clamp(target.top + target.height - popover.height - GAP, EDGE, viewport.height - popover.height - EDGE),
        left: clamp(target.left + target.width - popover.width - GAP, EDGE, viewport.width - popover.width - EDGE),
        side: null,
        arrow: null,
    };
}

function isScrollable(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    return /(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
}

/** Vùng cuộn gần nhất thật sự cuộn được (không chỉ khai báo overflow). */
export function findScrollParent(el: HTMLElement): HTMLElement | null {
    let node = el.parentElement;
    while (node && node !== document.body) {
        if (isScrollable(node)) return node;
        node = node.parentElement;
    }
    return null;
}

/**
 * Cuộn phần tử vào chỗ dễ nhìn — và để lại chỗ cho popover.
 *
 * Không dùng `scrollIntoView` trần: `block: 'start'` dán phần tử sát mép trên,
 * và với một phần tử cao hơn màn hình (cả bảng 8D) thì popover hết chỗ đứng.
 *
 *  - Vừa màn hình: đã thấy trọn thì để yên; chưa thì đưa vào giữa.
 *  - Cao hơn màn hình: chỉ cần mép trên nằm trong nửa trên; nếu không thì đưa
 *    mép trên xuống khoảng 40% chiều cao, chừa nửa trên cho popover.
 */
export function scrollIntoComfortView(el: HTMLElement): void {
    const container = findScrollParent(el);
    if (!container) return;

    const rect = el.getBoundingClientRect();
    const frame = container.getBoundingClientRect();
    const viewTop = Math.max(frame.top, 0);
    const viewBottom = Math.min(frame.bottom, window.innerHeight);
    const viewHeight = viewBottom - viewTop;
    if (viewHeight <= 0) return;

    let desiredTop: number;
    if (rect.height <= viewHeight - EDGE * 2) {
        if (rect.top >= viewTop + EDGE && rect.bottom <= viewBottom - EDGE) return;
        desiredTop = viewTop + (viewHeight - rect.height) / 2;
    } else {
        if (rect.top >= viewTop && rect.top <= viewTop + viewHeight * 0.5) return;
        desiredTop = viewTop + viewHeight * 0.4;
    }

    container.scrollBy({ top: rect.top - desiredTop, behavior: 'smooth' });
}
