import cds from '@sap/cds';

const LOG = cds.log('ai-startup');

/**
 * Probe khởi động cho SAP AI Core.
 *
 * ── Vì sao cần probe ──
 * Mọi thứ đều nạp lười: adapter chỉ đọc credential ở lần gọi model đầu tiên. Để
 * nguyên như vậy thì một bản deploy thiếu destination vẫn khởi động sạch sẽ, phục
 * vụ mọi màn hình bình thường, rồi vỡ đúng lúc người dùng bấm nút — giữa chừng
 * công việc của họ, trước mặt người ít có khả năng sửa nhất.
 *
 * Probe dời thời điểm vỡ đó về một dòng log ngay sau khi khởi động, nơi người vận
 * hành đang nhìn sẵn.
 *
 * ── Vì sao không chặn server ──
 * Probe hỏng thì báo, không chết. Các màn hình đọc từ DB vẫn dùng được khi AI Core
 * chưa thông, và crash-loop vì một destination tạm thời trục trặc biến một hệ
 * thống suy giảm thành một hệ thống ngừng hẳn.
 *
 * Không đọc credential nào và không tốn một lời gọi model nào.
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
 * Xác nhận credential AI Core giải được và có resource group.
 *
 * `getResourceGroup()` là lời gọi rẻ nhất mà vẫn chạy qua cả chuỗi — binding
 * destination service, token OAuth, tra destination, thuộc tính `resourceGroup` —
 * mà không tốn lời gọi model.
 *
 * Dòng log cũng nói rõ adapter đã đi **đường credential nào**, vì nó tự chọn trong
 * im lặng: có destination service bound thì dùng destination AICORE, không bound
 * thì dùng bất cứ `AICORE_*` nào còn sót trong `.env`. Hai đường đó thường trỏ tới
 * hai tenant AI Core khác nhau, nên một lần chạy lặng lẽ đi đường thứ hai sẽ hỏng
 * muộn hơn nhiều, với lỗi chẳng nói gì về cái binding đã biến mất.
 */
export async function probeAiCore(): Promise<void> {
  const localLlmUrl = process.env.LOCAL_LLM_URL || process.env.OPENAI_BASE_URL;
  if (localLlmUrl && localLlmUrl.trim().length > 0) {
    const model = process.env.LOCAL_LLM_MODEL || 'qwen2.5:3b';
    LOG.info(
      `[Local LLM] Đang kết nối Local Model (Qwen/Ollama/LM Studio) tại: '${localLlmUrl}' — Model: '${model}'.`,
    );
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 0) {
    const model = process.env.GEMINI_MODEL || process.env.AICORE_DEFAULT_MODEL || 'gemini-2.5-flash';
    const emb = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
    LOG.info(
      `[Gemini AI] Google Gemini API đã kích hoạt từ .env — Chat Model: '${model}', Embedding: '${emb}'.`,
    );
    return;
  }

  const hasAiCore = Boolean(
    process.env.AICORE_SERVICE_KEY ||
    (process.env.AICORE_AUTH_URL && process.env.AICORE_CLIENT_ID)
  );

  if (!hasAiCore) {
    LOG.info(
      '[AI Startup] Đang chạy ở chế độ Mock LLM độc lập (Free / Zero-Cost). ' +
        'Để dùng Google Gemini API thật, hãy thêm GEMINI_API_KEY=AIzaSy... vào file .env',
    );
    return;
  }

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
      'AI Core chưa kết nối được. Nếu bạn dùng Gemini, hãy điền GEMINI_API_KEY vào .env.',
      error?.message,
    );
  }
}

/** Chạy mọi probe mà không chặn khởi động. */
export function runAiStartupProbes(): void {
  void probeAiCore();
}
