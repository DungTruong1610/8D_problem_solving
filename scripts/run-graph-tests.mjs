/**
 * Chạy bộ test graph có chạm HANA.
 *
 * ── Vì sao là script chứ không phải một dòng trong package.json ──
 * Lệnh cần đặt hai biến môi trường TRƯỚC khi jest khởi động, và phải chạy bên
 * trong `cds bind --exec` để có credential. Viết thẳng vào npm script thì phải
 * lồng ba lớp nháy, và cách lồng đó khác nhau giữa cmd, PowerShell và bash — tức
 * là một lệnh chạy được trên máy này và vỡ trên máy khác, theo cách trông như
 * lỗi test.
 *
 * `GRAPH_INTEGRATION=1` là công tắc mà `graph.integration.test.ts` đọc. Không có
 * nó thì tệp đó `describe.skip`, và jest báo đúng chữ "skipped" thay vì "passed".
 */

import { spawnSync } from 'node:child_process';

const result = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'srv/src/domain/eightd/graph', '--runInBand', ...process.argv.slice(2)],
    {
        stdio: 'inherit',
        env: { ...process.env, GRAPH_INTEGRATION: '1', CDS_ENV: 'graph' },
    },
);

process.exit(result.status ?? 1);
