import {
  registerEmbeddingCorpora,
  type EmbeddingCorpus,
} from '@cnma/sap-aicore-integrate/react/shared';
import { EMBEDDING_DIM, DEFAULT_EMBEDDING_MODEL } from '../../config/ai';

/**
 * Điểm đăng ký kho vector.
 *
 * ── Vì sao file này bắt buộc phải có ──
 * Một corpus cho mỗi cột `cds.Vector(dim)` trong schema. `embeddingDim(kind)`
 * của CDK **ném lỗi với kind chưa đăng ký** — đó là fail-fast mình dựa vào để
 * chặn việc ghi vector sai số chiều vào DB.
 *
 * ── Lưu ý về defaultModel ──
 * Đó là model mà corpus này đã được nhúng lần đầu. Đổi nó là làm mất giá trị
 * mọi vector đã lưu: vector của hai model không nằm chung một không gian, cosine
 * giữa chúng vô nghĩa. Coi như bất biến trừ khi đã có quy trình nhúng lại toàn bộ.
 *
 * Mục dưới đây là chỗ giữ chỗ. Đội nghiệp vụ đổi `kind` và `schemaColumns` cho
 * khớp bảng thật khi schema có.
 */
export const APP_EMBEDDING_CORPORA: readonly EmbeddingCorpus[] = Object.freeze([
  Object.freeze({
    kind: 'default',
    label: 'Default corpus',
    description:
      'Placeholder corpus so the integration layer runs before any vector table exists. Replace kind and schemaColumns once the real schema lands.',
    dim: EMBEDDING_DIM,
    schemaColumns: `<Entity>.embedding cds.Vector(${EMBEDDING_DIM})`,
    defaultModel: DEFAULT_EMBEDDING_MODEL,
    modelEnvVar: 'AICORE_MODEL_EMBEDDING',
  }),
]);

let registered = false;

/** Idempotent — gọi nhiều lần vẫn chỉ đăng ký một lần. */
export function registerAppEmbeddingCorpora(): void {
  if (registered) return;
  registerEmbeddingCorpora([...APP_EMBEDDING_CORPORA]);
  registered = true;
  console.log(
    `[ai/embeddingCorpora] Đã đăng ký ${APP_EMBEDDING_CORPORA.length} corpus: ${APP_EMBEDDING_CORPORA.map((c) => c.kind).join(', ')}`,
  );
}
