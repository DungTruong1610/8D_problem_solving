using { cnma.valuehelp as valuehelp } from '@cnma/cap-valuehelp/db/valuehelp';

@path: '/api/cnma/VALUEHELP_SRV'
@(requires: 'authenticated-user')
service ValueHelpService {
    entity ValueHelpList as projection on valuehelp.ValueHelpList;

    /**
     * Đọc một danh sách F4, kèm quy tắc dán giá trị.
     *
     * ── Vì sao `function` chứ không `action` ──
     * Đây là phép ĐỌC. `function` ra HTTP GET: cache được, không cần CSRF token,
     * và đúng nghĩa với việc nó làm. `action` ra POST — chạy được, nhưng khai báo
     * một phép đọc là phép ghi thì mọi tầng phía trên (cache của trình duyệt,
     * proxy, log) đều hiểu sai.
     *
     * Trả về CHUỖI JSON chứ không phải entity: mỗi danh sách một bộ cột khác nhau
     * — `returnMapping` mang theo cột nào là do cấu hình của chính dòng đó quyết
     * định, nên không có một kiểu tĩnh nào tả đúng được cả bảy danh sách.
     */
    function getValueHelp(
        objectType     : String,
        valueHelpID    : String,
        filter         : String,
        dependsOnValue : String
    ) returns String;

    /**
     * Tìm nhiều tiêu chí, có phân trang — cho hộp thoại Search Help.
     *
     * `filters` và `columns` là chuỗi JSON vì số tiêu chí thay đổi theo từng danh
     * sách, giống lý do ở trên.
     */
    function getValueHelpSearch(
        objectType  : String,
        valueHelpID : String,
        filters     : String,
        columns     : String,
        top         : Integer,
        skip        : Integer
    ) returns String;
}
