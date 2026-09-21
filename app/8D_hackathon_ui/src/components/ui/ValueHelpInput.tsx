import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input, cn } from '@cnma/react-ui';
import { Check, ChevronDown, Info, TriangleAlert, X } from 'lucide-react';
import { isOutsideCatalogue, type ValueHelpEntry } from '@/services/value-help-service';

/**
 * Ô nhập có trợ giúp giá trị (F4).
 *
 * ── Vì sao phải gợi ý ──
 * Ba mã `workCenterId`, `defectCode`, `materialId` được chấm TRÙNG KHỚP TUYỆT
 * ĐỐI khi tìm tiền lệ: 4 + 4 + 3 trên tổng 16 điểm, ngưỡng 3. Gõ `WC-MILL-7`
 * thay vì `WC-MILL-07` là mất 4 điểm — âm thầm, không lỗi, case chỉ đơn giản
 * quay về "không có tiền lệ".
 *
 * ── Vì sao danh sách KHÔNG lọc theo giá trị đã chọn ──
 * Bản đầu lọc gợi ý theo đúng nội dung đang có trong ô. Nghe hợp lý khi người
 * dùng đang gõ dở. Nhưng sau khi CHỌN xong, nội dung ô chính là mã vừa chọn —
 * nên bộ lọc thu danh sách xuống còn đúng một dòng: cái vừa chọn. Mở lại ô ra
 * chỉ thấy chính nó, và ô trông như bị khoá cứng. Muốn đổi thì phải tự bôi đen
 * xoá tay, mà không có gì trên màn hình nói cho người dùng biết điều đó.
 *
 * Nên tách làm hai trạng thái:
 *   - ĐANG DUYỆT (`typed === false`) — vừa focus vào, hoặc vừa chọn xong. Hiện
 *     TOÀN BỘ danh mục, con trỏ đứng sẵn ở mục đang chọn. Đây là hành vi F4 của
 *     SAP GUI: bấm vào là thấy hết, không phải thấy mỗi thứ mình đã có.
 *   - ĐANG GÕ (`typed === true`) — người dùng vừa gõ một phím. Lọc theo những gì
 *     họ gõ.
 * Focus cũng bôi đen sẵn nội dung, nên gõ là thay chứ không phải nối thêm vào
 * đuôi mã cũ.
 *
 * ── `strict`: F4 CỨNG (quyết định Q3) ──
 * Bản đầu chỉ cảnh báo rồi vẫn cho lưu. Lập luận khi đó: khoá cứng sẽ chặn đúng
 * trường hợp đáng quan tâm nhất — lỗi trên một vật tư MỚI, chưa từng có case nào.
 * Lập luận đó có một lỗ: nó giả định đường thoát duy nhất là gõ tay vào form.
 * Không phải — đường thoát là MASTER DATA. Thêm mã ở đó rồi quay lại chọn thì
 * catalogue vẫn đúng, và mọi case sau đó cũng chọn được mã ấy. Gõ tay chỉ giải
 * quyết được cho đúng một case, rồi để lại một mã mồ côi không ai tra được.
 *
 * Nên: `strict` chặn lưu, và cảnh báo GIỮ NGUYÊN nội dung giải thích cái giá phải
 * trả, cộng thêm câu chỉ đường ra. Chặn mà không chỉ đường thì người dùng chỉ còn
 * cách bỏ trống ô — tệ hơn hẳn một giá trị sai.
 *
 * ── Vì sao KHÔNG chặn khi danh mục rỗng ──
 * Xem `isOutsideCatalogue`: backend hỏng không được biến thành "không ai lưu được
 * gì". Điều kiện chặn nằm ở một hàm dùng chung để ô nhập và nút Save không thể
 * nói hai điều khác nhau.
 *
 * `disabled` khi danh sách chưa nạp xong thì KHÔNG dùng: người dùng gõ nhanh hơn
 * mạng, và một ô bị khoá trong hai giây là một ô bị mất chữ.
 */

export interface ValueHelpInputProps {
    value: string;
    onChange: (value: string) => void;
    /** Nhận nguyên dòng để phía gọi tự áp `returnMapping`. */
    onPick?: (entry: ValueHelpEntry) => void;
    entries: ValueHelpEntry[];
    loading?: boolean;
    placeholder?: string;
    id?: string;
    /** Tắt cảnh báo "không có trong danh mục" — cho ô không tham gia chấm điểm. */
    quiet?: boolean;
    /** Điều gì mất đi khi mã không khớp danh mục. Hiện trong cảnh báo. */
    scoringNote?: string;
    /** Tên danh mục, dùng trong dòng gợi ý. */
    catalogLabel?: string;
    /** F4 cứng: giá trị ngoài danh mục hiện thành LỖI. Phía gọi chặn Save. */
    strict?: boolean;
    /** Nơi thêm giá trị mới, hiện trong thông báo lỗi của `strict`. */
    maintenanceHint?: string;
    disabled?: boolean;
    className?: string;
    inputClassName?: string;
    /** Chọn gán 'key' hay 'text' vào ô nhập khi commit. Mặc định là 'key'. */
    pickKey?: 'key' | 'text';
    /** Hướng mở danh sách dropdown: 'bottom' (mặc định) hoặc 'top' (sổ lên trên). */
    dropdownPlacement?: 'bottom' | 'top';
}

/**
 * Trần số dòng hiển thị.
 *
 * Rộng tay hơn hẳn con số 8 cũ, vì bây giờ focus vào là hiện cả danh mục chứ
 * không phải hiện phần lọc. Khung có `max-h-64` và cuộn được, nên số dòng lớn
 * không phá bố cục; còn cắt danh mục 25 mã xuống 8 thì lại đúng vào cái bẫy cũ:
 * người dùng không tìm thấy mục mình cần và tưởng là không có.
 */
const MAX_SUGGESTIONS = 60;

export function ValueHelpInput(props: ValueHelpInputProps) {
    const {
        value, onChange, onPick, entries, loading = false,
        placeholder, id, quiet = false, scoringNote, catalogLabel = 'the value help',
        strict = false, maintenanceHint = 'Add it in Master Data first.', disabled = false, className,
        inputClassName,
        pickKey = 'key', dropdownPlacement = 'bottom',
    } = props;
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    // `false` = đang duyệt danh mục (vừa focus, hoặc vừa chọn xong).
    // `true`  = người dùng đã gõ, danh sách lọc theo những gì họ gõ.
    const [typed, setTyped] = useState(false);
    const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);

    const query = value.trim().toLowerCase();
    // Chỉ lọc khi người dùng đang gõ. Sau khi chọn xong, giá trị trong ô CHÍNH LÀ
    // mã đã chọn — lấy nó làm bộ lọc thì danh sách còn đúng một dòng.
    const filterQuery = typed ? query : '';

    const matches = useMemo(() => {
        if (!entries.length) return [];
        return entries
            .filter((entry) =>
                !filterQuery
                || String(entry.key ?? '').toLowerCase().includes(filterQuery)
                || String(entry.text ?? '').toLowerCase().includes(filterQuery))
            .slice(0, MAX_SUGGESTIONS);
    }, [entries, filterQuery]);

    /** Vị trí của mục đang được chọn trong danh sách đang hiện — để đánh dấu và để con trỏ đứng sẵn ở đó. */
    const selectedIndex = useMemo(() => {
        if (!query) return -1;
        return matches.findIndex(
            (entry) =>
                String(entry.key ?? '').trim().toLowerCase() === query
                || String(entry.text ?? '').trim().toLowerCase() === query,
        );
    }, [matches, query]);

    // Cuộn mục đang chọn vào tầm nhìn khi mở danh mục đầy đủ. Danh mục 25 mã mà
    // mục đang chọn nằm ở dòng 19 thì mở ra vẫn như chưa chọn gì.
    useEffect(() => {
        if (!open || !listRef.current) return;
        const node = listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
        node?.scrollIntoView({ block: 'nearest' });
    }, [open, highlight, matches.length]);

    // Chỉ báo khi người dùng ĐÃ gõ và danh mục ĐÃ nạp xong. Trong lúc chờ mạng thì
    // mọi mã đều "không khớp", và doạ nhầm là cách nhanh nhất để người dùng học
    // cách bỏ qua cảnh báo. Điều kiện nằm trong `isOutsideCatalogue` — CÙNG hàm mà
    // nút Save dùng để chặn, nên hai chỗ không thể nói khác nhau.
    const outside = useMemo(
        () => isOutsideCatalogue(entries, value, loading),
        [entries, value, loading],
    );
    const showUnknown = outside && !quiet;

    const commit = (entry: ValueHelpEntry) => {
        const val = pickKey === 'text' ? String(entry.text ?? entry.key ?? '') : String(entry.key ?? '');
        onChange(val);
        onPick?.(entry);
        setOpen(false);
        // Quay về trạng thái duyệt: lần mở sau phải thấy lại cả danh mục để còn
        // đổi được, chứ không phải thấy mỗi mã vừa chọn.
        setTyped(false);
    };

    const openForBrowsing = () => {
        setTyped(false);
        setOpen(true);
        setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    };

    const clearValue = () => {
        onChange('');
        setTyped(false);
        setHighlight(0);
        setOpen(true);
        inputRef.current?.focus();
    };

    const hasClear = Boolean(value) && !disabled;

    return (
        <div className={cn('relative', className)}>
            <div className="relative">
                <Input
                    id={inputId}
                    ref={inputRef}
                    value={value}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    placeholder={placeholder}
                    disabled={disabled}
                    aria-invalid={strict && outside}
                    className={cn(
                        'font-mono text-sm',
                        // Chừa chỗ cho nút xoá và mũi tên ở mép phải.
                        hasClear ? 'pr-14' : 'pr-8',
                        showUnknown && (strict ? 'border-destructive' : 'border-warning/60'),
                        inputClassName,
                    )}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setTyped(true);
                        setOpen(true);
                        setHighlight(0);
                    }}
                    onFocus={(e) => {
                        // Bôi đen sẵn: gõ là THAY mã cũ, không phải nối vào đuôi nó.
                        e.target.select();
                        openForBrowsing();
                    }}
                    onBlur={() => {
                        // Nhấp vào một gợi ý cũng gây blur trước khi click chạy.
                        // Hoãn một nhịp để cú chọn kịp về.
                        blurTimer.current = setTimeout(() => {
                            setOpen(false);
                            setTyped(false);
                        }, 120);
                    }}
                    onKeyDown={(e) => {
                        // Mũi tên xuống khi danh sách đang đóng thì MỞ nó ra — đây là
                        // cách người quen SAP GUI mở F4 mà không cần chuột.
                        if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                            e.preventDefault();
                            openForBrowsing();
                            return;
                        }
                        if (!open || !matches.length) return;
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlight((h) => (h + 1) % matches.length);
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlight((h) => (h - 1 + matches.length) % matches.length);
                        } else if (e.key === 'Enter') {
                            // Chỉ nuốt Enter khi đang thực sự chọn trong danh sách —
                            // nếu không thì không submit được form bằng bàn phím.
                            e.preventDefault();
                            commit(matches[highlight]);
                        } else if (e.key === 'Escape') {
                            setOpen(false);
                            setTyped(false);
                        }
                    }}
                />

                {/* Nút xoá — đường thoát HIỂN THỊ ĐƯỢC khỏi một mã đã chọn.
                    Không có nó thì cách duy nhất để bỏ giá trị là bôi đen rồi xoá
                    tay, và không có gì trên màn hình nói ra điều đó. */}
                {hasClear && (
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label="Clear value"
                        title="Clear"
                        // `mousedown` xảy ra TRƯỚC blur — chặn nó lại thì ô không mất
                        // focus, nên xoá xong con trỏ vẫn ở đây và danh mục vẫn mở.
                        onMouseDown={(e) => {
                            e.preventDefault();
                            if (blurTimer.current) clearTimeout(blurTimer.current);
                        }}
                        onClick={clearValue}
                        className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}

                {/* Mũi tên: dấu hiệu duy nhất cho biết ô này CÓ danh sách để mở. */}
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Open value help"
                    disabled={disabled}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                    }}
                    onClick={() => {
                        if (disabled) return;
                        if (open) {
                            setOpen(false);
                            return;
                        }
                        inputRef.current?.focus();
                        inputRef.current?.select();
                        openForBrowsing();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                </button>
                {open && matches.length > 0 && (
                    <ul
                        ref={listRef}
                        role="listbox"
                        className={cn(
                            'absolute z-50 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md left-0',
                            dropdownPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
                        )}
                        onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
                    >
                        {matches.map((entry, index) => {
                            const isSelected = index === selectedIndex;
                            return (
                                <li key={String(entry.key)}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        data-index={index}
                                        onClick={() => commit(entry)}
                                        onMouseEnter={() => setHighlight(index)}
                                        className={cn(
                                            'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left',
                                            index === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                                        )}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-mono text-sm font-semibold">{String(entry.key)}</span>
                                            {entry.text && (
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {String(entry.text)}
                                                </span>
                                            )}
                                        </span>
                                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-success" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {/* Đã gõ nhưng không còn dòng nào khớp. Trước đây danh sách chỉ biến mất,
                    và một danh sách biến mất trông giống hệt một danh sách chưa nạp xong. */}
                {open && typed && Boolean(query) && !loading && entries.length > 0 && matches.length === 0 && (
                    <div
                        className={cn(
                            'absolute z-50 w-full rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md left-0',
                            dropdownPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
                        )}
                    >
                        No match in {catalogLabel}. Clear the field to see all {entries.length}.
                    </div>
                )}
            </div>

            {showUnknown && (
                <p
                    className={cn(
                        'mt-1 flex items-start gap-1 text-xs leading-normal',
                        strict ? 'text-destructive' : 'text-warning',
                    )}
                >
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        Not in {catalogLabel}.{scoringNote ? ` ${scoringNote}` : ''}
                        {strict ? ` ${maintenanceHint}` : ''}
                    </span>
                </p>
            )}

            {!quiet && !query && !loading && entries.length > 0 && (
                <p className="mt-1 flex items-start gap-1 text-xs leading-normal text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{entries.length} in {catalogLabel} — start typing to pick one.</span>
                </p>
            )}
        </div>
    );
}

export default ValueHelpInput;
