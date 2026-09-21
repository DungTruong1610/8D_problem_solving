import cds from '@sap/cds';
import {
  hasAiCoreCredentials,
  resolveChatProvider,
  resolveEmbeddingProvider,
} from './providerFactory';

const LOG = cds.log('ai-startup');

/**
 * Probe khởi động cho tầng AI.
 *
 * ── Vì sao cần probe ──
 * Mọi thứ đều nạp lười: provider chỉ đọc credential ở lần gọi model đầu tiên. Để
 * nguyên như vậy thì một bản deploy thiếu key vẫn khởi động sạch sẽ, phục vụ mọi
 * màn hình bình thường, rồi vỡ đúng lúc người dùng bấm nút — giữa chừng công việc
 * của họ, trước mặt người ít có khả năng sửa nhất.
 *
 * Probe dời thời điểm vỡ đó về một dòng log ngay sau khi khởi động, nơi người vận
 * hành đang nhìn sẵn. Nó nói rõ chat đi cổng nào, và có nhà cung cấp embedding hay
 * không — thiếu embedding là tiêu chí ngữ nghĩa im lặng cho 0 điểm, loại sự cố
 * không có thông báo lỗi nào khác.
 *
 * ── Vì sao không chặn server ──
 * Probe hỏng thì báo, không chết. Các màn hình đọc từ DB vẫn dùng được khi AI Core
 * chưa thông, và crash-loop vì một destination tạm thời trục trặc biến một hệ
 * thống suy giảm thành một hệ thống ngừng hẳn.
 *
 * Chỉ đọc biến môi trường (và một lời gọi credential AI Core khi đường đó được
 * chọn) — không tốn token model nào.
 */

/**
 * Nạp singleton adapter của CDK.
 *
 * CDK công bố `aiCore` dưới dạng default re-export — dạng mà interop CJS→ESM của
 * Node không nhìn xuyên qua được bằng named import. Đọc thẳng từ module object thì
 * chạy được với cả hai loader. Dùng dynamic import để việc require file này không
 * tự kéo theo cây phụ thuộc của adapter.
 */
async function loadAiCore(): Promise<any> {
  const mod: any = await import('@cnma/sap-aicore-integrate');
  return mod.aiCore || mod.default?.aiCore;
}

/**
 * Báo cáo tầng AI đang chạy bằng đường nào, ngay sau khi khởi động.
 *
 * Đọc từ `providerFactory` — cùng nguồn sự thật với `ensureLlmProvider`, nên
 * dòng log không thể lệch với provider thật đang phục vụ request. Chỉ đọc biến
 * môi trường, không gọi mạng, không tốn token.
 */
export async function probeAiCore(): Promise<void> {
  const chat = resolveChatProvider();
  const embeddings = resolveEmbeddingProvider();

  if (chat.provider) {
    LOG.info(`[AI] Chat: ${chat.label} — ${chat.detail}`);
  }

  if (embeddings.provider) {
    LOG.info(`[AI] Embedding: ${embeddings.label} — ${embeddings.detail}`);
  } else {
    LOG.warn(
      '[AI] Không có nhà cung cấp embedding. Tiêu chí ngữ nghĩa trong tìm tiền lệ sẽ không chạy. '
        + 'Cắm JINA_API_KEY (hoặc EMBEDDING_API_KEY + EMBEDDING_BASE_URL) để bật lại.',
    );
  }

  if (chat.provider) {
    if (chat.label === 'SAP AI Core') {
      await probeAiCoreCredentials();
    }
    return;
  }

  if (hasAiCoreCredentials()) {
    await probeAiCoreCredentials();
    return;
  }

  LOG.info(
    '[AI Startup] Đang chạy ở chế độ Mock LLM độc lập (Free / Zero-Cost). '
      + 'Để dùng AI thật, thêm DEEPSEEK_API_KEY (khuyến nghị) hoặc GEMINI_API_KEY vào .env',
  );
}

/** Xác nhận credential AI Core giải được và có resource group. */
async function probeAiCoreCredentials(): Promise<void> {
  try {
    const aiCore = await loadAiCore();
    if (!aiCore) throw new Error('@cnma/sap-aicore-integrate không export "aiCore"');

    const [resourceGroup, destination] = await Promise.all([
      aiCore.getResourceGroup(),
      aiCore.getSdkDestination(),
    ]);

    if (destination) {
      LOG.info(
        `AI Core thông qua destination '${destination.destinationName}' — resource group '${resourceGroup}'.`,
      );
      return;
    }
    LOG.warn(
      `AI Core đang chạy bằng credential trong biến môi trường AICORE_* (resource group '${resourceGroup}').`,
    );
  } catch (error: any) {
    LOG.warn(
      'AI Core chưa kết nối được. Nếu bạn dùng DeepSeek, hãy điền DEEPSEEK_API_KEY vào .env.',
      error?.message,
    );
  }
}

/** Chạy mọi probe mà không chặn khởi động. */
export function runAiStartupProbes(): void {
  void probeAiCore();
}
