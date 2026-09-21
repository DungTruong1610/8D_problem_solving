import cds from '@sap/cds';
import { buildFlexibleResponseSchema, buildRuntimeSources, normalizeStepConfig } from '../domain/eightd/runtimeConfig';
import type { DisciplineCode } from '../domain/eightd/types';
import { mapCase } from '../domain/eightd/caseMapper';
import { getStepPromptRuntimeConfig } from '../domain/eightd/precedent/configRepository';
import { ENTITIES } from '../config/ai';
import { getGlobalAiConfigRaw, saveGlobalAiConfig } from '../core/ai/globalModelConfig';
import { resolveEmbeddingProvider } from '../core/ai/providerFactory';
import { OpenAiEmbeddingLlmProvider } from '../core/ai/openAiEmbeddingProvider';
import {
  clearRetrievalConfigCache,
  seedRetrievalConfig,
  CRITERIA,
  SETTINGS,
  STEP_PROMPTS,
} from '../domain/eightd/precedent/configRepository';
import {
  clearProfileCache,
  cloneProfile,
  deleteProfile,
  getProfile,
  getProfileConfig,
  saveProfile,
  seedRetrievalProfiles,
  PROFILES,
  PROFILE_CRITERIA,
  STEP_BINDINGS,
} from '../domain/eightd/precedent/profileRepository';
import { explainScore, scoreCase, type ScorableCase } from '../domain/eightd/precedent/scoring';
import { buildSourceFieldCatalog, parseAttributes } from '../domain/eightd/precedent/sourceFields';
import { HISTORICAL_CASES } from '../domain/eightd/precedent/precedentRepository';
import { getGraphSettings, inspectStepProfiles } from '../domain/eightd/graph/settings';

const LOG = cds.log('ai-admin');

/**
 * Handler cho AiAdminService — backend của trang quản lý model.
 *
 * Chỉ làm hai việc: đồng bộ danh mục model từ AI Core, và trả về tập model một
 * activity được phép dùng. Việc đọc/ghi entity AIModels do CAP tự lo qua generic
 * handler, không cần viết gì thêm.
 */

/** Sắp xếp mặc định cho model mà bộ phân loại không có ý kiến. */
const MODEL_DEFAULT_SORT_ORDER = 100;

interface DiscoveredModel {
  /** CDK phơi id dưới tên `model` — KHÔNG phải `modelId` như tài liệu của nó viết. */
  model?: string;
  capabilities?: unknown[];
  contextWindow?: number;
  inputTokenCost?: number;
  outputTokenCost?: number;
  streamingSupported?: boolean;
  inputTypes?: unknown[];
  deprecated?: boolean;
  retirementDate?: string;
  version?: string;
}

interface DiscoveryModule {
  discoverFoundationModels(opts?: { force?: boolean }): Promise<DiscoveredModel[]>;
  classifyModel(modelId: string): { provider?: string; displayName?: string; sortOrder?: number };
}

let discoveryModule: DiscoveryModule | null = null;

/** Nạp lười để việc require file này không kéo theo cây phụ thuộc của discovery. */
async function getDiscovery(): Promise<DiscoveryModule> {
  if (!discoveryModule) {
    discoveryModule = (await import(
      '@cnma/sap-aicore-integrate/discovery'
    )) as unknown as DiscoveryModule;
  }
  return discoveryModule;
}

/**
 * Các cột do một lần discovery sở hữu và được phép ghi đè.
 *
 * `active` và `suitableActivities` cố ý vắng mặt — đó là quyết định của admin và
 * phải sống sót qua mỗi lần sync lại.
 */
function buildDiscoveryPatch(
  discovered: DiscoveredModel,
  classification: { provider?: string; displayName?: string; sortOrder?: number },
): Record<string, unknown> {
  return {
    provider: classification.provider,
    displayName: classification.displayName,
    capabilities: JSON.stringify(discovered.capabilities ?? []),
    contextWindow: discovered.contextWindow ?? null,
    inputTokenCost: discovered.inputTokenCost ?? null,
    outputTokenCost: discovered.outputTokenCost ?? null,
    streamingSupported: Boolean(discovered.streamingSupported),
    inputTypes: JSON.stringify(discovered.inputTypes ?? []),
    deprecated: Boolean(discovered.deprecated),
    retirementDate: discovered.retirementDate ?? null,
    version: discovered.version ?? null,
    sortOrder: classification.sortOrder ?? MODEL_DEFAULT_SORT_ORDER,
  };
}

function tryParseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e: any) {
    LOG.warn(`Bỏ qua JSON hỏng: ${e.message}`);
    return null;
  }
}

/**
 * `suitableActivities` bằng null nghĩa là "mọi activity" — quy ước của CDK.
 * Giá trị hỏng cũng xử lý như vậy, thay vì giấu luôn model đi.
 */
function isSuitableFor(model: Record<string, any>, activity?: string): boolean {
  if (!activity) return true;
  const activities = tryParseJson(model.suitableActivities);
  if (!Array.isArray(activities)) return true;
  return activities.includes(activity);
}

function toAvailableModel(model: Record<string, any>): Record<string, unknown> {
  return {
    model: model.modelId,
    provider: model.provider,
    displayName: model.displayName,
    capabilities: tryParseJson(model.capabilities) ?? [],
    suitableActivities: tryParseJson(model.suitableActivities),
  };
}

/**
 * Danh mục model khi chat chạy DeepSeek.
 *
 * Hai cổng đặt tên model khác nhau, nên danh mục phải khớp cổng đang gọi: chọn
 * `deepseek-flash` trong khi endpoint là OpenCode Go sẽ ăn 404 model-not-found.
 * Cổng suy ra từ `DEEPSEEK_BASE_URL`, và model đang cấu hình (`DEEPSEEK_MODEL`)
 * luôn được xếp đầu để ô chọn không bao giờ thiếu lựa chọn đang chạy thật.
 */
const DEEPSEEK_MODELS_OPENCODE: DiscoveredModel[] = [
  {
    model: 'deepseek-v4.1-flash',
    contextWindow: 1_048_576,
    capabilities: ['chat', 'vision', 'tools', 'structured_output', 'thinking'],
    streamingSupported: true,
  },
  {
    model: 'deepseek-v4-pro',
    contextWindow: 1_048_576,
    capabilities: ['chat', 'tools', 'structured_output', 'thinking'],
    streamingSupported: true,
  },
  {
    model: 'deepseek-v4-flash',
    contextWindow: 1_048_576,
    capabilities: ['chat', 'vision', 'tools', 'structured_output', 'thinking'],
    streamingSupported: true,
  },
];

const DEEPSEEK_MODELS_PLATFORM: DiscoveredModel[] = [
  {
    model: 'deepseek-flash',
    contextWindow: 1_048_576,
    capabilities: ['chat', 'vision', 'tools', 'structured_output', 'thinking'],
    streamingSupported: true,
  },
  {
    model: 'deepseek-v4-pro',
    contextWindow: 1_048_576,
    capabilities: ['chat', 'tools', 'structured_output', 'thinking'],
    streamingSupported: true,
  },
];

/** Model DeepSeek theo đúng cổng đang cấu hình, cộng model đang chạy nếu lạ. */
function deepseekCatalog(): DiscoveredModel[] {
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || '').toLowerCase();
  const list = baseUrl.includes('opencode.ai')
    ? [...DEEPSEEK_MODELS_OPENCODE]
    : [...DEEPSEEK_MODELS_PLATFORM];

  const configured = (process.env.DEEPSEEK_MODEL || '').trim();
  if (configured && !list.some((m) => m.model === configured)) {
    list.unshift({
      model: configured,
      contextWindow: 1_048_576,
      capabilities: ['chat', 'tools', 'structured_output'],
      streamingSupported: true,
    });
  }
  return list;
}

/**
 * Model embedding đang cấu hình, đưa vào danh mục để trang AI Settings hiển thị
 * nó như một model có thật thay vì một cái tên không tra được ở đâu.
 *
 * Gemini không cần mục này: `text-embedding-004` đã nằm sẵn trong GEMINI_MODELS.
 */
function embeddingCatalogEntries(): DiscoveredModel[] {
  const resolved = resolveEmbeddingProvider();
  if (!(resolved.provider instanceof OpenAiEmbeddingLlmProvider)) return [];

  const model = resolved.provider.getEmbeddingModelName();
  return [
    {
      model,
      contextWindow: 32_768,
      capabilities: ['embedding'],
      streamingSupported: false,
    },
  ];
}

function deepseekDisplayName(modelId: string): string {
  const clean = modelId.toLowerCase();
  if (clean.includes('4.1')) return 'DeepSeek V4.1 Flash';
  if (clean.includes('v4-pro') || clean.includes('4-pro')) return 'DeepSeek V4 Pro';
  if (clean.includes('v4-flash') || clean.includes('4-flash')) return 'DeepSeek V4 Flash';
  if (clean.includes('flash')) return 'DeepSeek V4.1 Flash';
  return modelId;
}

function classifyDeepSeekModel(modelId: string) {
  const clean = modelId.toLowerCase();
  if (clean.includes('embedding')) {
    const provider = clean.includes('jina') ? 'Jina' : 'Embedding';
    return { provider, displayName: modelId, sortOrder: 50 };
  }
  if (clean.includes('pro')) {
    return { provider: 'DeepSeek', displayName: deepseekDisplayName(modelId), sortOrder: 2 };
  }
  return { provider: 'DeepSeek', displayName: deepseekDisplayName(modelId), sortOrder: 1 };
}

const GEMINI_MODELS: DiscoveredModel[] = [
  {
    model: 'gemini-3.7-flash',
    contextWindow: 1048576,
    capabilities: ['chat', 'vision', 'tools', 'structured_output', 'thinking'],
    streamingSupported: true,
  },
  {
    model: 'gemini-2.5-flash',
    contextWindow: 1048576,
    capabilities: ['chat', 'vision', 'tools', 'structured_output'],
    streamingSupported: true,
  },
  {
    model: 'gemini-2.5-pro',
    contextWindow: 2097152,
    capabilities: ['chat', 'vision', 'tools', 'structured_output', 'thinking'],
    streamingSupported: true,
  },
  {
    model: 'gemini-2.0-flash',
    contextWindow: 1048576,
    capabilities: ['chat', 'vision', 'tools', 'structured_output'],
    streamingSupported: true,
  },
  {
    model: 'gemini-1.5-flash',
    contextWindow: 1048576,
    capabilities: ['chat', 'vision', 'tools', 'structured_output'],
    streamingSupported: true,
  },
  {
    model: 'gemini-1.5-pro',
    contextWindow: 2097152,
    capabilities: ['chat', 'vision', 'tools', 'structured_output'],
    streamingSupported: true,
  },
  {
    model: 'text-embedding-004',
    contextWindow: 2048,
    capabilities: ['embedding'],
    streamingSupported: false,
  },
];

function classifyGeminiModel(modelId: string) {
  const clean = modelId.toLowerCase();
  if (clean.includes('embedding') || clean.includes('jina')) {
    if (clean.includes('jina')) {
      return { provider: 'Jina', displayName: modelId, sortOrder: 50 };
    }
    return { provider: 'Google', displayName: 'Text Embedding 004', sortOrder: 50 };
  }
  if (clean.includes('3.7-flash')) {
    return { provider: 'Google', displayName: 'Gemini 3.7 Flash', sortOrder: 1 };
  }
  if (clean.includes('2.5-flash')) {
    return { provider: 'Google', displayName: 'Gemini 2.5 Flash', sortOrder: 2 };
  }
  if (clean.includes('2.5-pro')) {
    return { provider: 'Google', displayName: 'Gemini 2.5 Pro', sortOrder: 3 };
  }
  if (clean.includes('2.0-flash')) {
    return { provider: 'Google', displayName: 'Gemini 2.0 Flash', sortOrder: 4 };
  }
  return { provider: 'Google', displayName: modelId, sortOrder: 10 };
}

/**
 * Nạp lại danh mục model, theo đúng nhà cung cấp chat đang chạy.
 *
 * Thứ tự nhánh phản ánh thứ tự ưu tiên của `resolveChatProvider`:
 * DeepSeek → Gemini → discovery của AI Core. Danh mục phải khớp cổng đang gọi,
 * nếu không ô chọn model trên UI sẽ mời admin chọn những cái tên không tồn tại.
 */
async function syncModels(): Promise<string> {
  const db = await cds.connect.to('db');
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const isDeepSeek = Boolean(deepseekKey && deepseekKey.trim().length > 0);
  let mode: 'deepseek' | 'gemini' | 'aicore' = isDeepSeek
    ? 'deepseek'
    : Boolean(process.env.GEMINI_API_KEY) || !process.env.AICORE_AUTH_URL
      ? 'gemini'
      : 'aicore';

  let discovered: DiscoveredModel[] = [];
  if (mode === 'deepseek') {
    discovered = [...deepseekCatalog(), ...embeddingCatalogEntries()];
  } else if (mode === 'gemini') {
    discovered = [...GEMINI_MODELS, ...embeddingCatalogEntries()];
  } else {
    try {
      const discovery = await getDiscovery();
      discovered = await discovery.discoverFoundationModels({ force: true });
    } catch (e: any) {
      LOG.warn('Đồng bộ model AI Core thất bại, chuyển sang danh mục Google Gemini:', e.message);
      discovered = GEMINI_MODELS;
      mode = 'gemini';
    }
  }

  let discoveryClassifier: any = null;
  if (mode === 'aicore') {
    try {
      discoveryClassifier = await getDiscovery();
    } catch {
      discoveryClassifier = null;
    }
  }

  const existingModels = (await SELECT.from(ENTITIES.AI_MODELS).columns('modelId')) as Record<string, any>[];
  const existingSet = new Set(existingModels.map((m) => m.modelId));

  const updates: { modelId: string; patch: Record<string, unknown> }[] = [];
  const newEntries: Record<string, unknown>[] = [];

  for (const item of discovered) {
    const modelId = item.model;
    if (!modelId) continue;

    const classification = mode === 'deepseek'
      ? classifyDeepSeekModel(modelId)
      : mode === 'gemini' || !discoveryClassifier
        ? classifyGeminiModel(modelId)
        : discoveryClassifier.classifyModel(modelId);

    const patch = buildDiscoveryPatch(item, classification);
    if (existingSet.has(modelId)) {
      updates.push({ modelId, patch });
    } else {
      newEntries.push({
        modelId,
        active: true,
        suitableActivities: null,
        ...patch,
      });
    }
  }

  for (const { modelId, patch } of updates) {
    await UPDATE(ENTITIES.AI_MODELS).set(patch).where({ modelId });
  }

  if (newEntries.length > 0) {
    await INSERT.into(ENTITIES.AI_MODELS).entries(newEntries);
  }

  const added = newEntries.length;
  LOG.info(`Đã đồng bộ ${discovered.length} model từ nguồn "${mode}" (${added} mới)`);
  return JSON.stringify({
    synced: discovered.length,
    new: added,
    updated: discovered.length - added,
    total: discovered.length,
    source: mode,
  });
}


/** Model đang bật mà một activity được phép dùng, đã sắp xếp cho ô chọn. */
async function getAvailableModels(activity?: string): Promise<string> {
  const models = (await SELECT.from(ENTITIES.AI_MODELS).where({ active: true }).orderBy('sortOrder', 'modelId')) as Record<string, any>[];
  return JSON.stringify(models.filter((m) => isSuitableFor(m, activity)).map(toAvailableModel));
}

/**
 * Chấm thử hai case bằng MỘT profile.
 *
 * Nhận mã notification chứ không nhận UUID: admin nhìn thấy mã case trên màn
 * hình, không nhìn thấy khoá kỹ thuật.
 */
async function previewScore(caseA?: string, caseB?: string, profileKey?: string): Promise<string> {
  if (!caseA?.trim() || !caseB?.trim()) {
    return JSON.stringify({ error: 'caseA và caseB là bắt buộc (mã notification).' });
  }

  const cols = [
    'notificationId', 'symptomShortText', 'workCenterId', 'defectCode',
    'defectText', 'defectKeywords', 'materialId', 'materialFamily',
    // Thiếu hai cột này thì `cosineSimilarity` trả null và tiêu chí ngữ nghĩa
    // luôn cho 0 điểm — ô chấm thử trên UI sẽ mâu thuẫn với kết quả thật của
    // `findPrecedents`, mà không có gì báo là do đâu.
    'embedding', 'embeddingModel',
    // Cùng lý do, cho nhóm tiêu chí trỏ vào đường dẫn payload SAP.
    'attributesJson',
  ];

  const a = (await SELECT.one.from(HISTORICAL_CASES).columns(...cols).where({ notificationId: caseA.trim() })) as any;
  const b = (await SELECT.one.from(HISTORICAL_CASES).columns(...cols).where({ notificationId: caseB.trim() })) as any;

  const missing = [!a && caseA, !b && caseB].filter(Boolean);
  if (missing.length) {
    return JSON.stringify({ error: `Không có trong kho: ${missing.join(', ')}` });
  }

  const profile = await getProfile(profileKey);
  const withAttributes = (row: any): ScorableCase => ({
    ...row,
    attributes: parseAttributes(row.attributesJson),
  });
  const result = scoreCase(withAttributes(a), withAttributes(b), profile.criteria);

  const { bindings } = await getProfileConfig();
  return JSON.stringify({
    caseA: { notificationId: a.notificationId, symptomShortText: a.symptomShortText },
    caseB: { notificationId: b.notificationId, symptomShortText: b.symptomShortText },
    profileKey: profile.profileKey,
    profileLabel: profile.label,
    minScore: profile.minScore,
    // Bước nào đang chạy profile này — con số chấm thử chỉ có nghĩa khi biết nó
    // ảnh hưởng tới bước nào.
    appliesTo: Object.entries(bindings)
      .filter(([, key]) => key === profile.profileKey)
      .map(([code]) => code),
    ...result,
    explanation: explainScore(result),
  });
}

/**
 * Mọi field SAP gửi lên, quét từ payload thật trong kho.
 *
 * Quét cả kho chứ không lấy mẫu: một field chỉ xuất hiện ở hai case trong mười
 * hai vẫn là một field so được, và nó chính là loại field mà lấy mẫu sẽ bỏ sót.
 * Kho ở quy mô này (hàng chục tới hàng trăm case) thì quét hết là rẻ.
 */
async function getSourceFieldCatalog(): Promise<string> {
  try {
    const rows = (await SELECT.from(HISTORICAL_CASES).columns('sourcePayload').orderBy('notificationId')) as Record<string, any>[];
    const payloads = rows.flatMap((r) => {
      try {
        return r.sourcePayload ? [JSON.parse(r.sourcePayload)] : [];
      } catch {
        // Một payload hỏng không được làm mất cả danh mục — bỏ qua dòng đó.
        return [];
      }
    });
    return JSON.stringify({ caseCount: payloads.length, fields: buildSourceFieldCatalog(payloads) });
  } catch (e: any) {
    LOG.warn(`Không dựng được danh mục field nguồn: ${e.message}`);
    return JSON.stringify({ caseCount: 0, fields: [], error: e.message });
  }
}

/** Ghi lại mặc định cho cấu hình tìm tiền lệ. */
async function resetRetrievalConfig(scope = 'all'): Promise<string> {
  const wanted = scope.trim().toLowerCase();
  const wipe = async (entity: string) => DELETE.from(entity);

  if (wanted === 'all' || wanted === 'criteria') await wipe(CRITERIA);
  if (wanted === 'all' || wanted === 'settings') await wipe(SETTINGS);
  if (wanted === 'all' || wanted === 'prompts') await wipe(STEP_PROMPTS);
  if (wanted === 'all' || wanted === 'profiles') {
    // Xoá tiêu chí TRƯỚC profile: ở tầng db thuần không có cascade nào chạy hộ,
    // và tiêu chí mồ côi sẽ được `getProfileConfig` gom vào một profile không
    // còn tồn tại — tức là biến mất khỏi UI mà vẫn chiếm chỗ trong DB.
    await wipe(PROFILE_CRITERIA);
    await wipe(STEP_BINDINGS);
    await wipe(PROFILES);
  }
  if (wanted.startsWith('prompt:')) {
    const stepCode = wanted.slice('prompt:'.length).toUpperCase();
    if (!/^D[1-8]$/.test(stepCode)) throw new Error(`Invalid step prompt scope: ${scope}`);
    await DELETE.from(STEP_PROMPTS).where({ stepCode });
  }

  // Hai hàm seed chỉ ghi phần còn thiếu — xoá trước rồi seed lại chính là "khôi
  // phục mặc định". Thứ tự bắt buộc: profile `default` dựng từ bảng trọng số
  // toàn cục, nên bảng đó phải được seed trước.
  await seedRetrievalConfig();
  await seedRetrievalProfiles();
  clearRetrievalConfigCache();
  clearProfileCache();

  LOG.info(`Đã khôi phục mặc định cấu hình truy hồi (scope=${wanted})`);
  const { profiles, bindings } = await getProfileConfig();
  return JSON.stringify({ reset: wanted, profiles, bindings });
}

/**
 * Các entity CHỈ có tác dụng khi engine truy hồi là `scoring`.
 *
 * Engine graph không đọc một dòng nào trong số này, và cũng không gọi embedding.
 */
const SCORING_ONLY_ENTITIES = [
  'SimilarityCriteria', 'RetrievalSettings',
  'RetrievalProfiles', 'ProfileCriteria', 'StepRetrievalBindings',
] as const;

/** Các entity chỉ có tác dụng khi engine là `graph`. Quan hệ ngược lại hoàn toàn. */
const GRAPH_ONLY_ENTITIES = ['GraphStepParams'] as const;

/**
 * Nói cho admin biết khi thứ họ vừa lưu KHÔNG có tác dụng ở engine đang chạy.
 *
 * ── Vì sao cảnh báo lúc LƯU chứ không phải lúc mở màn hình ──
 * Lúc mở màn hình, người ta chưa có ý định gì. Khoảnh khắc hiểu lầm xảy ra là
 * khoảnh khắc bấm lưu và tin rằng mình vừa đổi được hành vi của hệ thống. Không
 * có dòng này thì màn hình báo "đã lưu", dữ liệu đúng là đã lưu thật, mà kết quả
 * phân tích không đổi một chút nào — không lỗi, không log, không manh mối.
 *
 * Dùng `req.info` chứ không `req.reject`: cấu hình vẫn hợp lệ và vẫn nên được
 * lưu. Người ta có thể đang chuẩn bị trước cho lần đổi engine. Cái sai duy nhất
 * là tưởng nó đang chạy.
 */
async function warnIfEngineMismatch(req: any): Promise<void> {
  const entity = String(req.target?.name ?? '').split('.').pop() ?? '';
  const scoringOnly = (SCORING_ONLY_ENTITIES as readonly string[]).includes(entity);
  const graphOnly = (GRAPH_ONLY_ENTITIES as readonly string[]).includes(entity);
  if (!scoringOnly && !graphOnly) return;

  const { engine } = await getGraphSettings();

  if (scoringOnly && engine === 'graph') {
    req.info(
      `Đã lưu, nhưng engine truy hồi đang là "graph" nên ${entity} KHÔNG có tác dụng: `
      + 'engine graph không đọc trọng số chấm điểm và không dùng embedding. '
      + 'Chỉnh trọng số của graph ở GraphStepParams, hoặc đổi '
      + 'GraphRetrievalSettings.engine về "scoring".',
    );
  }
  if (graphOnly && engine !== 'graph') {
    req.info(
      `Đã lưu, nhưng engine truy hồi đang là "${engine}" nên ${entity} chưa có tác dụng. `
      + 'Đặt GraphRetrievalSettings.engine = "graph" để dùng.',
    );
  }
}

/** Gắn handler vào service. Gọi từ hook `serving` trong srv/server.ts. */
export function registerAiAdminHandlers(srv: any): void {
  // Sau khi lưu, không phải trước: cấu hình vẫn hợp lệ và vẫn được lưu bình thường.
  for (const entity of [...SCORING_ONLY_ENTITIES, ...GRAPH_ONLY_ENTITIES]) {
    srv.after(['CREATE', 'UPDATE', 'DELETE'], entity, async (_: unknown, req: any) => {
      await warnIfEngineMismatch(req).catch(() => { /* cảnh báo hỏng không được làm hỏng lưu */ });
    });
  }

  srv.on('syncModels', async () => syncModels());
  srv.on('getAvailableModels', async (req: any) => getAvailableModels(req.data?.activity));

  srv.on('graphStepDiagnostics', async () => {
    const [{ engine, maxKeywords, fallbackEnabled }, steps] = await Promise.all([
      getGraphSettings(),
      inspectStepProfiles(),
    ]);
    return JSON.stringify({ engine, maxKeywords, fallbackEnabled, steps });
  });

  srv.on('previewScore', async (req: any) =>
    previewScore(req.data?.caseA, req.data?.caseB, req.data?.profileKey));
  srv.on('getSourceFieldCatalog', async () => getSourceFieldCatalog());

  srv.on('cloneRetrievalProfile', async (req: any) => {
    try {
      await cloneProfile(String(req.data?.sourceKey ?? ''), {
        profileKey: String(req.data?.profileKey ?? ''),
        label: String(req.data?.label ?? ''),
        description: req.data?.description ?? null,
      });
      return JSON.stringify(await getProfileConfig());
    } catch (e: any) {
      // Khoá trùng hay khoá sai định dạng là lỗi của người gọi, không phải sự cố.
      return req.reject(e.code ?? 500, e.message);
    }
  });

  srv.on('saveRetrievalProfile', async (req: any) => {
    try {
      const payload = JSON.parse(String(req.data?.payload ?? '{}'));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return req.reject(400, 'payload phải là một object JSON.');
      }
      await saveProfile(String(req.data?.profileKey ?? ''), payload);
      return JSON.stringify(await getProfileConfig());
    } catch (e: any) {
      // JSON hỏng và cấu hình không hợp lệ đều là lỗi của người gọi.
      return req.reject(e.code ?? (e instanceof SyntaxError ? 400 : 500), e.message);
    }
  });

  srv.on('deleteRetrievalProfile', async (req: any) => {
    try {
      const { rebound } = await deleteProfile(String(req.data?.profileKey ?? ''));
      return JSON.stringify({ rebound, ...(await getProfileConfig()) });
    } catch (e: any) {
      return req.reject(e.code ?? 500, e.message);
    }
  });
  srv.on('previewStepConfiguration', async (req: any) => {
    const stepCode = String(req.data?.stepCode ?? req.params?.[0]?.stepCode ?? '').toUpperCase();
    if (!/^D[1-4]$/.test(stepCode)) return req.reject(400, 'stepCode must be D1, D2, D3, or D4');
    try {
      const context = mapCase(JSON.parse(String(req.data?.payload ?? '')));
      const raw = await getStepPromptRuntimeConfig(stepCode);
      if (!raw) return req.reject(404, `No configuration found for ${stepCode}`);
      const config = normalizeStepConfig(stepCode as DisciplineCode, raw);
      const effectiveInput = buildRuntimeSources(context, {}, {}, []);
      return JSON.stringify({ stepCode, configVersion: config.configVersion, effectiveInput, dataSchema: config.inputSchema, servingSchema: buildFlexibleResponseSchema({ [stepCode]: config }), formSchema: config.formSchema, rules: config.rules });
    } catch (error) {
      return req.reject(400, error instanceof Error ? error.message : 'Preview failed');
    }
  });
  srv.on('resetRetrievalConfig', async (req: any) => resetRetrievalConfig(req.data?.scope ?? 'all'));

  srv.before(['UPDATE', 'CREATE'], 'StepPrompts', (req: any) => {
    for (const field of ['inputSchemaJson', 'formSchemaJson', 'constraintsJson']) {
      const value = req.data?.[field];
      if (value === null || value === undefined || value === '') continue;
      try {
        JSON.parse(value);
      } catch (error: any) {
        req.reject(400, `${field} must contain valid JSON: ${error.message}`);
      }
    }
    if (typeof req.data?.combinedPrompt === 'string' && req.data.combinedPrompt.split(/\r?\n/).length > 80) {
      req.reject(400, 'combinedPrompt must not exceed 80 lines');
    }
    const stepCode = String(req.data?.stepCode ?? '').toUpperCase();
    if (/^D[1-4]$/.test(stepCode)) {
      try {
        normalizeStepConfig(stepCode as DisciplineCode, req.data);
      } catch (error) {
        req.reject(400, error instanceof Error ? error.message : 'Invalid step configuration');
      }
    }
  });

  /**
   * Chặn giá trị mà `scoring.ts` không có nhánh xử lý.
   *
   * `matchType` sai chính tả không gây lỗi ở bất kỳ đâu: tiêu chí chỉ đơn giản
   * không bao giờ ăn điểm, và nó vẫn được cộng vào trần điểm — nên mọi case tự
   * nhiên tụt hạng và không có gì chỉ về nguyên nhân. Bắt tại cửa ghi là chỗ duy
   * nhất còn nói được câu gì có ích.
   */
  const MATCH_TYPES = new Set(['exact', 'keyword', 'family', 'cosine']);
  srv.before(['CREATE', 'UPDATE'], 'ProfileCriteria', (req: any) => {
    const { matchType, fallbackMatch, weight, fallbackWeight, minSimilarity, sourceField } = req.data ?? {};

    if (matchType != null && !MATCH_TYPES.has(String(matchType))) {
      req.reject(400, `matchType phải là một trong: ${[...MATCH_TYPES].join(', ')}`);
    }
    if (fallbackMatch != null && fallbackMatch !== '' && !MATCH_TYPES.has(String(fallbackMatch))) {
      req.reject(400, `fallbackMatch phải là một trong: ${[...MATCH_TYPES].join(', ')}`);
    }
    if (matchType === 'cosine' && sourceField != null && String(sourceField) !== 'embedding') {
      req.reject(400, 'Tiêu chí cosine phải so trên trường "embedding" — không trường nào khác có vector.');
    }
    for (const [name, value] of [['weight', weight], ['fallbackWeight', fallbackWeight]] as const) {
      if (value == null) continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) req.reject(400, `${name} phải là số không âm.`);
    }
    if (minSimilarity != null) {
      const n = Number(minSimilarity);
      if (!Number.isFinite(n) || n < 0 || n > 1) req.reject(400, 'minSimilarity phải nằm trong khoảng 0–1.');
    }
  });

  // Cấu hình có cache 5 phút. Không xoá cache sau khi ghi thì admin sửa trọng số
  // xong bấm chấm thử vẫn ra điểm cũ — và sẽ kết luận là nút lưu bị hỏng.
  for (const entity of ['SimilarityCriteria', 'RetrievalSettings', 'StepPrompts']) {
    srv.after(['UPDATE', 'CREATE', 'DELETE'], entity, () => clearRetrievalConfigCache());
  }
  for (const entity of ['RetrievalProfiles', 'ProfileCriteria', 'StepRetrievalBindings']) {
    srv.after(['UPDATE', 'CREATE', 'DELETE'], entity, () => clearProfileCache());
  }

  srv.on('getGlobalAiConfig', async () => getGlobalAiConfigRaw());
  srv.on('updateGlobalAiConfig', async (req: any) => {
    try {
      return await saveGlobalAiConfig(req.data?.aiAgentConfig);
    } catch (e: any) {
      // Payload hỏng là lỗi của người gọi, không phải lỗi hệ thống.
      return req.reject(e.code === 400 ? 400 : 500, e.message);
    }
  });

  LOG.info('Đã gắn handler AiAdminService');
}

export async function seedDefaultModelsIfEmpty(): Promise<void> {
  try {
    const db = await cds.connect.to('db');
    const count = await db.run(SELECT.from(ENTITIES.AI_MODELS).columns('count(*) as cnt'));
    const total = Number(count[0]?.cnt ?? count[0]?.CNT ?? 0);
    if (total === 0) {
      LOG.info('Bảng AIModels đang rỗng. Tự động nạp danh mục model theo nhà cung cấp đang cấu hình...');
      await syncModels();
    }
  } catch (err: any) {
    LOG.warn('Không thể kiểm tra hoặc nạp AIModels lúc khởi động:', err.message);
  }
}

export { syncModels, getAvailableModels };

