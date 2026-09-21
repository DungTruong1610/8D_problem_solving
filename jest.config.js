/**
 * Cấu hình jest cho backend.
 *
 * Chỉ chạy test của lớp domain thuần — mapper, validator, JSON extractor,
 * postProcess. Đây là những chỗ có luật rõ ràng và kiểm chứng được mà không cần
 * gọi AI Core. Phần chất lượng prompt thì test tự động không phán được; dùng
 * `scripts/run-analyze.ts` để đánh giá bằng mắt.
 */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/srv'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: [
        'srv/src/domain/**/*.ts',
        '!srv/src/domain/**/__tests__/**',
    ],
    // `isolatedModules` khai trong tsconfig.json — ts-jest đọc từ đó.
    // Transpile từng file độc lập: nhanh hơn, và không kéo cả @cds-models vào
    // vòng kiểm kiểu của mỗi lần chạy test. `npm run typecheck` mới là chỗ
    // kiểm kiểu toàn dự án.
};
