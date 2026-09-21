import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import * as path from 'path'

// Backend CAP chạy ở 4008 — xem package.json → scripts.dev:backend. Đổi port thì
// sửa đúng dòng này; trước đây 6 route mỗi route ghi cứng một địa chỉ nên chỉ cần
// bỏ sót một chỗ là FE gọi trượt sang cổng không có ai nghe.
const BACKEND_URL = 'http://127.0.0.1:4008'

/** Mọi route API proxy giống hệt nhau: cùng backend, cùng basic-auth của user mocked. */
const api = (extra = {}) => ({
    target: BACKEND_URL,
    changeOrigin: true,
    secure: false,
    headers: { Authorization: 'Basic YWRtaW46MTIz' },
    ...extra,
})

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(), // Tailwind v4 — no postcss.config needed
    ],
    base: './',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),

            // ⚠️ ĐỪNG BỎ DÒNG NÀY.
            //
            // react-hook-form phát hành HAI bản: dist/index.esm.mjs cho `import`
            // và dist/index.cjs.js cho `require`. Code của app là ESM nên lấy bản
            // .mjs; còn @cnma/sap-aicore-integrate là CommonJS nên esbuild lấy bản
            // .cjs khi pre-bundle. Hai file khác nhau ⇒ hai module ⇒ HAI React
            // context khác nhau.
            //
            // Hậu quả: AiModelSelection và AiAgentConfigJson gọi useFormContext()
            // và nhận null, dù đã bọc FormProvider hoàn toàn đúng:
            //     Cannot destructure property 'watch' of 'useFormContext(...)' as it is null
            //
            // `dedupe` KHÔNG sửa được, vì dedupe chỉ gộp các bản trùng đường dẫn —
            // ở đây hai bên resolve ra hai file khác nhau ngay từ đầu. Alias thẳng
            // về một file là cách duy nhất buộc cả hai dùng chung một module.
            'react-hook-form': path.resolve(
                __dirname,
                './node_modules/react-hook-form/dist/index.esm.mjs',
            ),
        },
        dedupe: ['react', 'react-dom', 'react-hook-form'],
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
    },
    server: {
        port: 5544,
        proxy: {
            '/odata': api(),
            '/api/cnma': api(),
            '/identity': api(),
            '/identity-admin': api({
                configure: (proxy: any) => {
                    proxy.on('error', (err: Error) => console.error('[Vite Proxy Error /identity-admin]:', err.message));
                },
            }),
            '/workflow': api(),
            '/workflow-admin': api(),
        },
    },
})
