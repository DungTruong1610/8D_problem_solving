import { Fragment, type ReactNode } from 'react';

/**
 * Trình dựng markdown tối giản cho phần `content` của discipline.
 *
 * ── Vì sao tự viết thay vì cài react-markdown ──
 * Prompt đã ràng buộc model chỉ dùng đoạn văn, gạch đầu dòng, danh sách đánh số
 * và **in đậm** — không tiêu đề (giao diện đã hiện tên discipline), không bảng,
 * không link, không ảnh. Cài thêm một thư viện markdown đầy đủ kèm sanitizer cho
 * đúng bốn thứ đó là không tương xứng.
 *
 * Nếu về sau prompt cho phép bảng hoặc link thì thay bằng thư viện thật — đừng
 * đắp thêm vào đây.
 */

/** Tách **in đậm** và `code` thành các đoạn con. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
    const out: ReactNode[] = [];
    // Chia theo cả hai kiểu đánh dấu trong một lượt để giữ đúng thứ tự xuất hiện.
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    parts.forEach((part, i) => {
        const key = `${keyPrefix}-${i}`;
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            out.push(<strong key={key} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>);
        } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            out.push(
                <code key={key} className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">
                    {part.slice(1, -1)}
                </code>,
            );
        } else if (part) {
            out.push(<Fragment key={key}>{part}</Fragment>);
        }
    });

    return out;
}

interface Block {
    type: 'p' | 'ul' | 'ol';
    lines: string[];
}

/** Gom các dòng liền nhau cùng loại thành khối. */
function toBlocks(markdown: string): Block[] {
    const blocks: Block[] = [];
    let current: Block | null = null;

    const flush = () => {
        if (current) blocks.push(current);
        current = null;
    };

    for (const raw of markdown.split('\n')) {
        const line = raw.trim();

        if (!line) {
            flush();
            continue;
        }

        const bullet = line.match(/^[-*]\s+(.*)$/);
        const numbered = line.match(/^\d+[.)]\s+(.*)$/);

        if (bullet) {
            if (current?.type !== 'ul') { flush(); current = { type: 'ul', lines: [] }; }
            current.lines.push(bullet[1]);
        } else if (numbered) {
            if (current?.type !== 'ol') { flush(); current = { type: 'ol', lines: [] }; }
            current.lines.push(numbered[1]);
        } else {
            if (current?.type !== 'p') { flush(); current = { type: 'p', lines: [] }; }
            current.lines.push(line);
        }
    }
    flush();

    return blocks;
}

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
    const blocks = toBlocks(children ?? '');

    return (
        <div className={`min-w-0 max-w-full space-y-3 break-words text-sm leading-relaxed text-foreground/90 ${className}`}>
            {blocks.map((block, bi) => {
                if (block.type === 'p') {
                    return (
                        <p key={bi} className="max-w-full break-words">
                            {block.lines.map((l, li) => (
                                <Fragment key={li}>
                                    {li > 0 && ' '}
                                    {renderInline(l, `${bi}-${li}`)}
                                </Fragment>
                            ))}
                        </p>
                    );
                }

                const ListTag = block.type === 'ul' ? 'ul' : 'ol';
                return (
                    <ListTag
                        key={bi}
                        className={
                            block.type === 'ul'
                                ? 'list-disc pl-5 space-y-1.5'
                                : 'list-decimal pl-5 space-y-1.5'
                        }
                    >
                        {block.lines.map((l, li) => (
                            <li key={li} className="break-words">{renderInline(l, `${bi}-${li}`)}</li>
                        ))}
                    </ListTag>
                );
            })}
        </div>
    );
}
