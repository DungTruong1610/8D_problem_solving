import type { KeyboardEvent } from 'react';

/**
 * Bấm Tab trong một ô RỖNG → điền đúng chuỗi placeholder của ô đó, rồi vẫn nhảy
 * sang ô kế như bình thường.
 *
 * ── Dùng thế nào ──
 * Gắn MỘT lần lên thẻ bọc (thường là `<form>`), không phải lên từng ô:
 *
 *     <form onKeyDown={fillPlaceholderOnTab} ...>
 *
 * Sự kiện keydown nổi bọt lên, nên một handler phủ được mọi ô bên trong — thêm ô
 * mới không phải nhớ nối dây lại.
 *
 * ── Vì sao không chặn Tab ──
 * Không gọi `preventDefault`: Tab vẫn chuyển focus như trình duyệt vẫn làm. Nhờ
 * vậy giữ Tab là chạy hết cả form, mỗi ô rỗng tự điền khi đi qua — và người dùng
 * bàn phím không mất cách di chuyển quen thuộc.
 *
 * ── Vì sao chỉ điền ô rỗng ──
 * Ô đã có chữ là chữ người dùng gõ. Ghi đè nó bằng dữ liệu mẫu là mất dữ liệu
 * thật, mà lại xảy ra ở thao tác vô hại nhất — chỉ đơn giản tab qua một ô.
 */
export function fillPlaceholderOnTab(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Tab') return;
    // Shift+Tab là đi lùi, và các tổ hợp có phím điều khiển là lệnh khác — đừng
    // biến chúng thành thao tác ghi dữ liệu.
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
    if (target.disabled || target.readOnly) return;
    if (target.value !== '') return;

    let text = target.placeholder.trim();
    if (!text) return;
    text = text.replace(/^e\.g\.\s*/i, '');
    if (!text) return;

    // Với những kiểu này, placeholder không phải là một giá trị hợp lệ để gán —
    // trình duyệt sẽ lặng lẽ bỏ qua và ô vẫn rỗng.
    if (target instanceof HTMLInputElement && NON_TEXTUAL_INPUT_TYPES.has(target.type)) return;

    setReactValue(target, text);
}

const NON_TEXTUAL_INPUT_TYPES = new Set([
    'button', 'checkbox', 'color', 'date', 'datetime-local', 'file',
    'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week',
]);

/**
 * Gán giá trị vào một ô React ĐANG controlled.
 *
 * Gán thẳng `el.value = x` là không đủ. React thay property `value` trên chính
 * instance element bằng setter riêng để theo dõi thay đổi; gán thẳng sẽ đi qua
 * setter đó, React không ghi nhận gì, và lần render kế tiếp trả ô về giá trị cũ
 * trong state — chữ hiện lên rồi biến mất.
 *
 * Cách đúng: lấy setter GỐC trên prototype để bỏ qua lớp theo dõi của React, gán
 * bằng nó, rồi tự bắn sự kiện `input` để React chạy `onChange` như thể người
 * dùng vừa gõ.
 */
function setReactValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const prototype = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (setter) setter.call(el, value);
    else el.value = value;

    el.dispatchEvent(new Event('input', { bubbles: true }));
}
