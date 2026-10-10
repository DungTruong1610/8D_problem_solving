/**
 * Kiểu dữ liệu của Guided Tour.
 *
 * Tour là DỮ LIỆU, không phải code: một mảng bước, mỗi bước nói nó nằm ở trang
 * nào, chỉ vào phần tử nào (selector CSS), và cần trang đó ở trạng thái nào (tab
 * nào đang mở, dialog nào đang bật). Các trang tự đọc trạng thái đó qua
 * `useTourControl` — tour không bấm hộ người dùng vào DOM, nên không phụ thuộc
 * vào việc một nút phản ứng với `click` hay `mousedown`.
 */

/** Trang mà một bước cần đứng. Trang chi tiết case được chọn lúc chạy tour. */
export type TourPage = 'worklist' | 'masterData' | 'aiConfig' | 'caseDetail';

/**
 * Trạng thái giao diện tour có thể yêu cầu. Mỗi trang chỉ đọc khoá của mình.
 *
 * Giá trị phải trùng đúng union của state trong trang — lệch một chữ là
 * TypeScript báo ngay ở chỗ trang gọi `useTourControl`.
 */
export interface TourControls {
    'worklist.createDialog': 'pick' | 'import';
    'masterData.tab': 'inspection-lots' | 'defects' | 'historical-cases' | 'code-catalogues';
    'aiConfig.tab': 'global' | 'graph' | 'models';
    'caseDetail.tab': 'disciplines' | 'evidence' | 'summary';
    /** `current`: bước đầu tiên chưa hoàn tất — bước người dùng sẽ làm tiếp. */
    'caseDetail.step': 'current' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8';
}

export type TourControlKey = keyof TourControls;

export type TourSide = 'top' | 'bottom' | 'left' | 'right';

export type TourChapterId = 'intro' | 'reports' | 'masterData' | 'aiConfig' | 'case' | 'outro';

export interface TourStep {
    id: string;
    chapter: TourChapterId;
    /** Bỏ trống: đứng yên ở trang hiện tại. */
    page?: TourPage;
    /** Selector CSS của phần tử được chiếu sáng. Bỏ trống: popover ở giữa màn hình. */
    target?: string;
    title: string;
    /** Hỗ trợ `**đậm**` và `{case}` (số 8D của case tour đang mở). */
    body: string;
    bullets?: string[];
    /** Phía ưu tiên đặt popover; không đủ chỗ thì tự chọn phía khác. */
    side?: TourSide;
    /**
     * Đặt popover cạnh phần tử NÀY thay vì cạnh phần tử được chiếu sáng — dùng
     * khi phần tử nằm trong một dialog: popover đứng ngoài dialog, không che nó.
     */
    anchor?: string;
    /** Popover rộng hơn cho bước có danh sách dài — thấp hơn, dễ tìm chỗ đứng hơn. */
    wide?: boolean;
    controls?: Partial<TourControls>;
    /** Phần tử có thể không tồn tại (banner đã ẩn, bảng rỗng…) — không thấy thì bỏ qua bước. */
    optional?: boolean;
    /** Khoảng hở quanh vùng chiếu sáng, px. */
    padding?: number;
}

/** Case mà chương "Working a case" mở ra. */
export interface TourCaseRef {
    id: string;
    notificationId: string;
}
