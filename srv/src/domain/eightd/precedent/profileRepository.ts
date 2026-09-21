/**
 * Profile chấm điểm và ràng buộc profile ↔ bước D.
 *
 * ── Vì sao tách khỏi `configRepository.ts` ──
 * File kia giữ cấu hình TOÀN CỤC: một bộ tiêu chí, một bộ ngưỡng, prompt từng
 * bước. File này giữ thứ có nhiều bản và được chọn theo ngữ cảnh. Trộn chung thì
 * cache của hai vòng đời khác nhau nằm trong một biến, và xoá cache vì đổi prompt
 * sẽ kéo theo nạp lại cả bộ profile mà không có lý do gì.
 *
 * `configRepository.getRetrievalConfig()` vẫn còn, và giờ trả về profile mặc
 * định — mọi thứ đọc nó tiếp tục chạy đúng như trước.
 */

import cds from '@sap/cds';
import { DEFAULT_CRITERIA, DEFAULT_RETRIEVAL_SETTINGS, RERANK_PROFILE_SPECS } from './defaults';
import { CRITERIA, SETTINGS } from './configRepository';
import type { Criterion } from './scoring';

const LOG = cds.log('retrieval-profiles');

export const PROFILES = 'cnma.proresolve.RetrievalProfiles';
export const PROFILE_CRITERIA = 'cnma.proresolve.ProfileCriteria';
export const STEP_BINDINGS = 'cnma.proresolve.StepRetrievalBindings';

/** Profile luôn tồn tại và không xoá được — mọi bước rơi về đây khi thiếu ràng buộc. */
export const DEFAULT_PROFILE_KEY = 'default';

export const STEP_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;
export type StepCode = (typeof STEP_CODES)[number];

const STEP_LABELS: Readonly<Record<StepCode, string>> = Object.freeze({
    D1: 'Establish the Team',
    D2: 'Describe the Problem',
    D3: 'Interim Containment Actions',
    D4: 'Root Cause Analysis',
    D5: 'Permanent Corrective Actions',
    D6: 'Verify Effectiveness',
    D7: 'Prevent Recurrence',
    D8: 'Closure and Recognition',
});

export interface RetrievalProfile {
    profileKey: string;
    label: string;
    description: string | null;
    minScore: number;
    topN: number;
    closedOnly: boolean;
    isSystem: boolean;
    sortOrder: number;
    criteria: Criterion[];
}

/** Toàn bộ cấu hình theo profile, nạp một lần rồi cache. */
export interface ProfileConfig {
    profiles: RetrievalProfile[];
    /** D1…D8 → profileKey. Luôn đủ tám khoá. */
    bindings: Record<StepCode, string>;
}

/** Cùng lý do và cùng độ dài với cache trong `configRepository.ts`. */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: ProfileConfig | null = null;
let cachedAt = 0;

export function clearProfileCache(): void {
    cached = null;
    cachedAt = 0;
}

/** Dòng DB → `Criterion`. Một chỗ duy nhất ép kiểu, dùng cho cả hai bảng tiêu chí. */
function toCriterion(r: Record<string, any>): Criterion {
    return {
        criterionKey: r.criterionKey,
        label: r.label,
        // Với tiêu chí `rerank`, description CHÍNH LÀ instruction gửi model —
        // không map thì tầng re-rank chạy với câu hỏi rỗng.
        description: r.description ?? null,
        sourceField: r.sourceField,
        matchType: r.matchType || 'exact',
        weight: Number(r.weight) || 0,
        fallbackField: r.fallbackField ?? null,
        fallbackMatch: r.fallbackMatch ?? null,
        fallbackWeight: r.fallbackWeight == null ? null : Number(r.fallbackWeight),
        minSimilarity: r.minSimilarity == null ? null : Number(r.minSimilarity),
        enabled: r.enabled !== false,
        sortOrder: Number(r.sortOrder) || 0,
    };
}

/**
 * Profile mặc định dựng từ hằng số trong code.
 *
 * Dùng khi bảng chưa seed hoặc đọc lỗi. Không bao giờ trả rỗng: tìm tiền lệ bằng
 * trọng số mặc định vẫn tốt hơn nhiều so với không tìm được gì chỉ vì một bảng
 * cấu hình chưa kịp seed.
 */
function fallbackProfile(): RetrievalProfile {
    return {
        profileKey: DEFAULT_PROFILE_KEY,
        label: 'Default',
        description: 'Bộ trọng số dùng chung khi một bước chưa chọn profile riêng.',
        minScore: DEFAULT_RETRIEVAL_SETTINGS.minScore,
        topN: DEFAULT_RETRIEVAL_SETTINGS.topN,
        closedOnly: DEFAULT_RETRIEVAL_SETTINGS.closedOnly,
        isSystem: true,
        sortOrder: 10,
        criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })),
    };
}

function fallbackConfig(): ProfileConfig {
    return {
        profiles: [fallbackProfile()],
        bindings: Object.fromEntries(
            STEP_CODES.map((code) => [code, DEFAULT_PROFILE_KEY]),
        ) as Record<StepCode, string>,
    };
}

/**
 * Mọi profile kèm tiêu chí, và bảng ràng buộc bước D → profile.
 *
 * Ràng buộc trỏ vào một profile đã bị xoá sẽ bị kéo về `default` NGAY TẠI ĐÂY,
 * không để người gọi tự xử: một bước không có profile nghĩa là bước đó im lặng
 * mất hết tiền lệ, và triệu chứng đó không chỉ về nguyên nhân này.
 */
async function getDb() {
    return (cds.db || (await cds.connect.to('db')));
}

export async function getProfileConfig(): Promise<ProfileConfig> {
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

    try {
        const db = await getDb();
        const profileRows = (await db.run(SELECT.from(PROFILES).orderBy('sortOrder', 'profileKey'))) as Record<string, any>[];
        const criteriaRows = (await db.run(SELECT.from(PROFILE_CRITERIA).orderBy('sortOrder'))) as Record<string, any>[];
        const bindingRows = (await db.run(SELECT.from(STEP_BINDINGS))) as Record<string, any>[];

        const byProfile = new Map<string, Criterion[]>();
        for (const row of criteriaRows) {
            const key = String(row.profile_profileKey ?? row.profile?.profileKey ?? '');
            if (!key) continue;
            const list = byProfile.get(key) ?? [];
            list.push(toCriterion(row));
            byProfile.set(key, list);
        }

        const profiles: RetrievalProfile[] = profileRows.map((r) => ({
            profileKey: String(r.profileKey),
            label: r.label ?? r.profileKey,
            description: r.description ?? null,
            minScore: Number(r.minScore ?? DEFAULT_RETRIEVAL_SETTINGS.minScore),
            topN: Number(r.topN ?? DEFAULT_RETRIEVAL_SETTINGS.topN),
            closedOnly: r.closedOnly !== false,
            isSystem: r.isSystem === true,
            sortOrder: Number(r.sortOrder) || 0,
            criteria: byProfile.get(String(r.profileKey)) ?? [],
        }));

        if (!profiles.length) {
            cached = fallbackConfig();
            cachedAt = Date.now();
            return cached;
        }

        const known = new Set(profiles.map((p) => p.profileKey));
        const fallbackKey = known.has(DEFAULT_PROFILE_KEY)
            ? DEFAULT_PROFILE_KEY
            : profiles[0].profileKey;

        const declared = new Map(
            bindingRows.map((r) => [
                String(r.stepCode),
                String(r.profile_profileKey ?? r.profile?.profileKey ?? ''),
            ]),
        );
        const bindings = Object.fromEntries(
            STEP_CODES.map((code) => {
                const wanted = declared.get(code);
                return [code, wanted && known.has(wanted) ? wanted : fallbackKey];
            }),
        ) as Record<StepCode, string>;

        cached = { profiles, bindings };
    } catch (e: any) {
        LOG.warn(`Không đọc được profile chấm điểm, dùng mặc định: ${e.message}`);
        cached = fallbackConfig();
    }

    cachedAt = Date.now();
    return cached;
}

/** Một profile theo khoá. Không có ⇒ profile mặc định, không bao giờ null. */
export async function getProfile(profileKey?: string | null): Promise<RetrievalProfile> {
    const { profiles } = await getProfileConfig();
    const wanted = String(profileKey ?? '').trim();
    return (
        (wanted && profiles.find((p) => p.profileKey === wanted))
        || profiles.find((p) => p.profileKey === DEFAULT_PROFILE_KEY)
        || profiles[0]
        || fallbackProfile()
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed và chuyển đổi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dựng profile `default` từ cấu hình toàn cục ĐANG CHẠY, không phải từ hằng số.
 *
 * Đây là điểm mấu chốt của lần chuyển đổi này. Admin đã chỉnh trọng số trên bảng
 * cũ; seed từ `DEFAULT_CRITERIA` sẽ âm thầm kéo mọi thứ về mặc định của code và
 * mọi hồ sơ chấm lại sẽ ra điểm khác — không lỗi, không cảnh báo, chỉ là kết quả
 * đổi. Đọc bảng cũ trước, chỉ rơi về hằng số khi nó thật sự rỗng.
 */
async function readLegacyGlobalConfig(): Promise<{
    criteria: Criterion[];
    minScore: number;
    topN: number;
    closedOnly: boolean;
}> {
    try {
        const db = await getDb();
        const rows = (await db.run(SELECT.from(CRITERIA).orderBy('sortOrder'))) as Record<string, any>[];
        const settings = (await db.run(SELECT.one.from(SETTINGS).where({ ID: 'GLOBAL' }))) as Record<string, any> | null;
        const criteria = rows.map(toCriterion);
        return {
            criteria: criteria.length ? criteria : DEFAULT_CRITERIA.map((c) => ({ ...c })),
            minScore: Number(settings?.minScore ?? DEFAULT_RETRIEVAL_SETTINGS.minScore),
            topN: Number(settings?.topN ?? DEFAULT_RETRIEVAL_SETTINGS.topN),
            closedOnly: settings?.closedOnly !== false,
        };
    } catch (e: any) {
        LOG.warn(`Không đọc được cấu hình toàn cục cũ (${e.message}) — seed từ hằng số trong code.`);
        return {
            criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })),
            minScore: DEFAULT_RETRIEVAL_SETTINGS.minScore,
            topN: DEFAULT_RETRIEVAL_SETTINGS.topN,
            closedOnly: DEFAULT_RETRIEVAL_SETTINGS.closedOnly,
        };
    }
}

/** Mô tả đi kèm mỗi tiêu chí mặc định, tra theo khoá. */
const CRITERION_DESCRIPTIONS = new Map(
    DEFAULT_CRITERIA.map((c) => [c.criterionKey, { description: c.description, sourceTable: c.sourceTable }]),
);

function criterionRow(profileKey: string, c: Criterion, index: number): Record<string, unknown> {
    const meta = CRITERION_DESCRIPTIONS.get(c.criterionKey);
    return {
        profile_profileKey: profileKey,
        criterionKey: c.criterionKey,
        label: c.label,
        // Ưu tiên description của CHÍNH tiêu chí: với `rerank` đó là instruction
        // admin đã sửa, và clone/save phải giữ nguyên nó thay vì tra lại bản
        // mặc định theo criterionKey.
        description: c.description ?? meta?.description ?? null,
        sourceTable: meta?.sourceTable ?? null,
        sourceField: c.sourceField,
        matchType: c.matchType,
        weight: c.weight,
        fallbackField: c.fallbackField ?? null,
        fallbackMatch: c.fallbackMatch ?? null,
        fallbackWeight: c.fallbackWeight ?? null,
        minSimilarity: c.minSimilarity ?? null,
        enabled: c.enabled,
        sortOrder: c.sortOrder ?? (index + 1) * 10,
    };
}

/**
 * Đảm bảo luôn có profile `default` và đủ tám dòng ràng buộc.
 *
 * Idempotent, chạy mỗi lần khởi động. Chỉ BÙ phần thiếu — profile do admin tạo
 * và ràng buộc admin đã đổi không bị đụng tới. Cùng lý do với
 * `seedRetrievalConfig`: dữ liệu admin chỉnh trên UI phải sống sót qua deploy.
 *
 * Không bao giờ ném lên trên: app phải khởi động được kể cả khi seed hỏng, vì
 * `getProfileConfig()` đã có đường rơi về mặc định trong code.
 */
export async function seedRetrievalProfiles(): Promise<void> {
    try {
        const db = await getDb();
        const existing = (await db.run(SELECT.from(PROFILES).columns('profileKey'))) as any[];
        const haveDefault = existing.some(
            (r: any) => String(r.profileKey) === DEFAULT_PROFILE_KEY,
        );

        if (!haveDefault) {
            const legacy = await readLegacyGlobalConfig();
            await db.run(
                INSERT.into(PROFILES).entries({
                    profileKey: DEFAULT_PROFILE_KEY,
                    label: 'Default',
                    description:
                        'Bộ trọng số dùng chung, chuyển từ cấu hình toàn cục trước đây. '
                        + 'Mọi bước D chưa chọn profile riêng đều chạy bộ này.',
                    minScore: legacy.minScore,
                    topN: legacy.topN,
                    closedOnly: legacy.closedOnly,
                    isSystem: true,
                    sortOrder: 10,
                }),
            );
            if (legacy.criteria.length) {
                await db.run(
                    INSERT.into(PROFILE_CRITERIA).entries(
                        legacy.criteria.map((c, i) => criterionRow(DEFAULT_PROFILE_KEY, c, i)),
                    ),
                );
            }
            LOG.info(
                `Đã tạo profile "${DEFAULT_PROFILE_KEY}" từ cấu hình toàn cục đang chạy: `
                + `${legacy.criteria.length} tiêu chí, ngưỡng ${legacy.minScore}, top ${legacy.topN}`,
            );
        }

        // Bù theo TỪNG BƯỚC, không phải "chỉ khi bảng rỗng" — thêm một bước mới
        // vào `STEP_CODES` rồi deploy phải tới được môi trường đã chạy.
        const boundRows = (await db.run(SELECT.from(STEP_BINDINGS).columns('stepCode'))) as any[];
        const bound = new Set(boundRows.map((r: any) => String(r.stepCode)));
        const missing = STEP_CODES.filter((code) => !bound.has(code));
        if (missing.length) {
            await db.run(
                INSERT.into(STEP_BINDINGS).entries(
                    missing.map((code, i) => ({
                        stepCode: code,
                        label: STEP_LABELS[code],
                        profile_profileKey: DEFAULT_PROFILE_KEY,
                        sortOrder: (STEP_CODES.indexOf(code) + 1 + i * 0) * 10,
                    })),
                ),
            );
            LOG.info(`Đã gán profile mặc định cho ${missing.length} bước: ${missing.join(', ')}`);
        }

        // ── Hai profile re-rank cho D4/D5 ───────────────────────────────────
        // Idempotent: profile đã tồn tại thì KHÔNG đụng — kể cả tiêu chí lẫn
        // binding, vì admin có thể đã chỉnh cả hai. Chỉ DB chưa từng có mới seed.
        // isSystem = true (không xoá được, như `default`) — muốn bỏ re-rank thì
        // TẮT tiêu chí, không phải xoá profile; xoá được thì boot sau seed lại
        // và trông như cấu hình tự hồi sinh.
        const haveKeys = new Set(existing.map((r: any) => String(r.profileKey)));
        for (const spec of RERANK_PROFILE_SPECS) {
            if (haveKeys.has(spec.profileKey)) continue;

            // Nhân bản tiêu chí từ `default` ĐANG CÓ TRONG DB (không phải hằng
            // số) — trọng số admin đã chỉnh trên default phải theo sang.
            const defProfile = (await db.run(
                SELECT.one.from(PROFILES).where({ profileKey: DEFAULT_PROFILE_KEY }),
            )) as Record<string, any> | null;
            const defRows = (await db.run(
                SELECT.from(PROFILE_CRITERIA)
                    .where({ profile_profileKey: DEFAULT_PROFILE_KEY })
                    .orderBy('sortOrder'),
            )) as Record<string, any>[];
            const baseCriteria = defRows.length
                ? defRows.map(toCriterion)
                : DEFAULT_CRITERIA.map((c) => ({ ...c }));

            await db.run(
                INSERT.into(PROFILES).entries({
                    profileKey: spec.profileKey,
                    label: spec.label,
                    description: spec.profileDescription,
                    minScore: Number(defProfile?.minScore ?? DEFAULT_RETRIEVAL_SETTINGS.minScore),
                    topN: Number(defProfile?.topN ?? DEFAULT_RETRIEVAL_SETTINGS.topN),
                    closedOnly: defProfile ? defProfile.closedOnly !== false : DEFAULT_RETRIEVAL_SETTINGS.closedOnly,
                    isSystem: true,
                    sortOrder: 20 + RERANK_PROFILE_SPECS.indexOf(spec) * 10,
                }),
            );
            await db.run(
                INSERT.into(PROFILE_CRITERIA).entries(
                    [...baseCriteria, spec.criterion].map((c, i) => criterionRow(spec.profileKey, c, i)),
                ),
            );

            // Chỉ kéo bước sang profile mới khi nó còn đứng ở `default` — một
            // binding admin đã tự tay đổi thì không bị cướp lại.
            const binding = (await db.run(
                SELECT.one.from(STEP_BINDINGS).where({ stepCode: spec.stepCode }),
            )) as Record<string, any> | null;
            const currentKey = String(binding?.profile_profileKey ?? binding?.profile?.profileKey ?? '');
            if (!binding || currentKey === DEFAULT_PROFILE_KEY) {
                await db.run(
                    UPDATE(STEP_BINDINGS)
                        .set({ profile_profileKey: spec.profileKey })
                        .where({ stepCode: spec.stepCode }),
                );
            }

            LOG.info(
                `Đã tạo profile "${spec.profileKey}" (${baseCriteria.length} tiêu chí + rerank, TẮT sẵn) `
                + `và gán cho ${spec.stepCode}${currentKey && currentKey !== DEFAULT_PROFILE_KEY ? ' — GIỮ binding admin đã chỉnh' : ''}`,
            );
        }

        clearProfileCache();
    } catch (e: any) {
        LOG.error(`Seed profile chấm điểm thất bại (app vẫn chạy với mặc định): ${e.message}`);
    }
}

/**
 * Tạo profile mới bằng cách nhân bản một profile đang có.
 *
 * Nhân bản chứ không tạo rỗng: một profile không tiêu chí nào không chấm nổi
 * điểm nào, nên "tạo mới" theo nghĩa rỗng luôn là một profile hỏng. Bắt đầu từ
 * một bộ chạy được rồi chỉnh trọng số mới đúng là việc admin thật sự làm.
 */
export async function cloneProfile(
    sourceKey: string,
    target: { profileKey: string; label: string; description?: string | null },
): Promise<void> {
    const db = await getDb();
    const key = target.profileKey.trim();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(key)) {
        throw Object.assign(
            new Error('profileKey chỉ gồm chữ thường, số và dấu gạch ngang, tối đa 40 ký tự.'),
            { code: 400 },
        );
    }

    const clash = await db.run(SELECT.one.from(PROFILES).where({ profileKey: key }));
    if (clash) throw Object.assign(new Error(`Profile "${key}" đã tồn tại.`), { code: 409 });

    const source = await getProfile(sourceKey);
    const allProfiles = (await db.run(SELECT.from(PROFILES).columns('sortOrder'))) as any[];
    const maxOrder = allProfiles.reduce((max: number, r: any) => Math.max(max, Number(r.sortOrder) || 0), 0);

    await db.run(
        INSERT.into(PROFILES).entries({
            profileKey: key,
            label: target.label.trim() || key,
            description: target.description ?? null,
            minScore: source.minScore,
            topN: source.topN,
            closedOnly: source.closedOnly,
            isSystem: false,
            sortOrder: maxOrder + 10,
        }),
    );
    if (source.criteria.length) {
        await db.run(
            INSERT.into(PROFILE_CRITERIA).entries(
                source.criteria.map((c, i) => criterionRow(key, c, i)),
            ),
        );
    }

    clearProfileCache();
    LOG.info(`Đã tạo profile "${key}" từ "${source.profileKey}" (${source.criteria.length} tiêu chí)`);
}

export interface SaveProfileInput {
    label?: string;
    description?: string | null;
    minScore?: number;
    topN?: number;
    closedOnly?: boolean;
    /** Bộ tiêu chí MỚI, kèm đầy đủ tham số chấm điểm — thay thế toàn bộ bộ cũ. */
    criteria?: Array<Record<string, unknown>>;
    /**
     * Danh sách FIELD của profile — thay thế thành viên, GIỮ NGUYÊN tham số chấm
     * điểm của những field đã có.
     *
     * ── Vì sao cần một đường ghi riêng thay vì dùng `criteria` ──
     * Trang Object Schema định nghĩa profile so những field nào; tab Similarity
     * của từng bước D chỉnh trọng số, cách so và ngưỡng. Hai màn hình sửa hai
     * thứ khác nhau trên cùng một bảng.
     *
     * Nếu Object Schema gửi cả `criteria`, nó sẽ ghi đè trọng số bằng bản đã nạp
     * lúc mở trang — tức là mọi chỉnh sửa ở tab Similarity từ lúc đó bị xoá, âm
     * thầm, chỉ vì ai đó kéo thêm một field. Gửi thành viên thôi thì không có
     * cách nào để chuyện đó xảy ra.
     */
    criteriaFields?: Array<Record<string, unknown>>;
    /** Bước D trỏ vào profile này sau khi lưu. Thay thế toàn bộ tập cũ. */
    steps?: string[];
}

const MATCH_TYPES = new Set(['exact', 'keyword', 'family', 'cosine']);

/**
 * Ghi cả profile trong MỘT lượt: cấu hình, bộ tiêu chí, và các bước trỏ vào nó.
 *
 * ── Vì sao một action thay vì nhiều lời gọi OData ──
 * Màn hình Object Schema sửa ba thứ cùng lúc — kéo field vào/ra, chỉnh trọng số,
 * đổi bước nào dùng profile. Gửi từng thay đổi thành một request nghĩa là một lần
 * bấm Save có thể thành công một nửa: tiêu chí đã đổi mà ràng buộc bước thì chưa,
 * và không có đường lùi. Driver SQLite của CAP lại chỉ có một connection, nên
 * mười request nối đuôi nhau cũng chậm hơn hẳn một request.
 *
 * ── Vì sao thay thế toàn bộ thay vì vá từng dòng ──
 * Người dùng kéo một field ra khỏi panel giữa nghĩa là "profile này không còn
 * tiêu chí đó". Diff phía client rồi gửi ba loại lệnh (thêm/sửa/xoá) là dựng lại
 * một bộ đồng bộ hoá ở tầng UI — và bộ đó sẽ lệch. Gửi trạng thái mong muốn,
 * server làm cho khớp.
 */
export async function saveProfile(profileKey: string, input: SaveProfileInput): Promise<void> {
    const db = await getDb();
    const key = String(profileKey ?? '').trim();

    const row = await db.run(SELECT.one.from(PROFILES).where({ profileKey: key }));
    if (!row) throw Object.assign(new Error(`Không có profile "${key}".`), { code: 404 });

    if (input.criteria && input.criteriaFields) {
        throw Object.assign(
            new Error('Gửi `criteria` hoặc `criteriaFields`, không gửi cả hai.'),
            { code: 400 },
        );
    }

    /**
     * Thành viên field → bộ tiêu chí đầy đủ, giữ lại tham số chấm điểm đã có.
     *
     * Field mới nhận trọng số 1 và TẮT SẴN. Bật ngay nghĩa là trần điểm đổi trước
     * khi có ai kịp đặt trọng số cho nó — mọi hồ sơ chấm lại sẽ ra điểm khác mà
     * không ai chủ ý gây ra.
     */
    const criteria = input.criteriaFields
        ? await (async () => {
            const existing = (await db.run(
                SELECT.from(PROFILE_CRITERIA).where({ profile_profileKey: key }),
            )) as Record<string, any>[];
            const tuningByKey = new Map(
                existing.map((r) => [String(r.criterionKey), r]),
            );
            return input.criteriaFields!.map((f) => {
                const previous = tuningByKey.get(String(f.criterionKey));
                return {
                    criterionKey: f.criterionKey,
                    label: f.label,
                    description: f.description,
                    sourceTable: f.sourceTable,
                    sourceField: f.sourceField,
                    matchType: previous?.matchType ?? f.matchType ?? 'exact',
                    weight: previous?.weight ?? 1,
                    fallbackField: previous?.fallbackField ?? null,
                    fallbackMatch: previous?.fallbackMatch ?? null,
                    fallbackWeight: previous?.fallbackWeight ?? null,
                    minSimilarity: previous?.minSimilarity
                        ?? (f.matchType === 'cosine' ? 0.7 : null),
                    enabled: previous ? previous.enabled !== false : false,
                };
            });
        })()
        : input.criteria;

    // ── Kiểm tra TRƯỚC khi ghi bất cứ thứ gì ─────────────────────────────────
    if (criteria) {
        const seen = new Set<string>();
        for (const c of criteria) {
            const criterionKey = String(c.criterionKey ?? '').trim();
            if (!criterionKey) throw Object.assign(new Error('Mỗi tiêu chí phải có criterionKey.'), { code: 400 });
            if (seen.has(criterionKey)) {
                throw Object.assign(new Error(`Tiêu chí "${criterionKey}" bị lặp trong profile.`), { code: 400 });
            }
            seen.add(criterionKey);

            const matchType = String(c.matchType ?? 'exact');
            if (!MATCH_TYPES.has(matchType)) {
                throw Object.assign(
                    new Error(`matchType "${matchType}" không có nhánh xử lý. Chọn: ${[...MATCH_TYPES].join(', ')}.`),
                    { code: 400 },
                );
            }
            if (c.fallbackMatch != null && c.fallbackMatch !== '' && !MATCH_TYPES.has(String(c.fallbackMatch))) {
                throw Object.assign(new Error(`fallbackMatch "${c.fallbackMatch}" không hợp lệ.`), { code: 400 });
            }
            if (matchType === 'cosine' && String(c.sourceField ?? '') !== 'embedding') {
                throw Object.assign(
                    new Error(`Tiêu chí "${criterionKey}" dùng cosine nhưng so trên "${c.sourceField}" — chỉ "embedding" có vector.`),
                    { code: 400 },
                );
            }
            if (!String(c.sourceField ?? '').trim()) {
                throw Object.assign(new Error(`Tiêu chí "${criterionKey}" chưa chọn field để so.`), { code: 400 });
            }
        }
    }

    const steps = input.steps;
    if (steps) {
        for (const step of steps) {
            if (!STEP_CODES.includes(step as StepCode)) {
                throw Object.assign(new Error(`"${step}" không phải một bước 8D hợp lệ.`), { code: 400 });
            }
        }
        if (new Set(steps).size !== steps.length) {
            throw Object.assign(new Error('Một bước D chỉ được trỏ vào một profile.'), { code: 400 });
        }
        if (steps.length > 1) {
            throw Object.assign(new Error('Mỗi profile chỉ được chọn tối đa một bước 8D để gán.'), { code: 400 });
        }
    }

    // ── Ghi ──────────────────────────────────────────────────────────────────
    const patch: Record<string, unknown> = {};
    if (input.label !== undefined) patch.label = String(input.label).trim() || key;
    if (input.description !== undefined) patch.description = input.description;
    if (input.minScore !== undefined) patch.minScore = Number(input.minScore);
    if (input.topN !== undefined) patch.topN = Number(input.topN);
    if (input.closedOnly !== undefined) patch.closedOnly = Boolean(input.closedOnly);
    if (Object.keys(patch).length) {
        await db.run(UPDATE(PROFILES).set(patch).where({ profileKey: key }));
    }

    if (criteria) {
        await db.run(DELETE.from(PROFILE_CRITERIA).where({ profile_profileKey: key }));
        if (criteria.length) {
            await db.run(
                INSERT.into(PROFILE_CRITERIA).entries(
                    criteria.map((c, index) => ({
                        profile_profileKey: key,
                        criterionKey: String(c.criterionKey),
                        label: c.label ?? String(c.criterionKey),
                        description: c.description ?? null,
                        sourceTable: c.sourceTable ?? null,
                        sourceField: String(c.sourceField),
                        matchType: String(c.matchType ?? 'exact'),
                        weight: Number(c.weight) || 0,
                        fallbackField: c.fallbackField || null,
                        fallbackMatch: c.fallbackMatch || null,
                        fallbackWeight: c.fallbackWeight == null ? null : Number(c.fallbackWeight),
                        minSimilarity: c.minSimilarity == null ? null : Number(c.minSimilarity),
                        enabled: c.enabled !== false,
                        sortOrder: (index + 1) * 10,
                    })),
                ),
            );
        }
    }

    if (steps) {
        const boundRows = (await db.run(
            SELECT.from(STEP_BINDINGS).columns('stepCode').where({ profile_profileKey: key }),
        )) as any[];
        const released = boundRows
            .map((r: any) => String(r.stepCode))
            .filter((code: string) => !steps.includes(code));

        if (released.length && key !== DEFAULT_PROFILE_KEY) {
            await db.run(
                UPDATE(STEP_BINDINGS)
                    .set({ profile_profileKey: DEFAULT_PROFILE_KEY })
                    .where({ stepCode: { in: released } }),
            );
        }
        if (steps.length) {
            await db.run(
                UPDATE(STEP_BINDINGS)
                    .set({ profile_profileKey: key })
                    .where({ stepCode: { in: steps } }),
            );
        }
    }

    clearProfileCache();
    LOG.info(
        `Đã lưu profile "${key}"`
        + (criteria ? `: ${criteria.length} tiêu chí` : '')
        + (steps ? `, gán cho ${steps.length ? steps.join(', ') : 'không bước nào'}` : ''),
    );
}

/**
 * Xoá một profile và mọi tiêu chí của nó; bước nào đang trỏ vào thì kéo về mặc định.
 */
export async function deleteProfile(profileKey: string): Promise<{ rebound: string[] }> {
    const db = await getDb();
    const key = String(profileKey ?? '').trim();

    if (key === DEFAULT_PROFILE_KEY) {
        throw Object.assign(
            new Error('Không xoá được profile mặc định — nó là chỗ mọi bước rơi về.'),
            { code: 400 },
        );
    }

    const row = await db.run(SELECT.one.from(PROFILES).where({ profileKey: key }));
    if (!row) throw Object.assign(new Error(`Không có profile "${key}".`), { code: 404 });
    if (row.isSystem === true) {
        throw Object.assign(new Error(`Profile "${key}" là profile hệ thống.`), { code: 400 });
    }

    const affected = (await db.run(
        SELECT.from(STEP_BINDINGS).columns('stepCode').where({ profile_profileKey: key }),
    )) as any[];
    const rebound = affected.map((r: any) => String(r.stepCode));
    if (rebound.length) {
        await db.run(
            UPDATE(STEP_BINDINGS)
                .set({ profile_profileKey: DEFAULT_PROFILE_KEY })
                .where({ profile_profileKey: key }),
        );
    }

    await db.run(DELETE.from(PROFILE_CRITERIA).where({ profile_profileKey: key }));
    await db.run(DELETE.from(PROFILES).where({ profileKey: key }));

    clearProfileCache();
    LOG.info(
        `Đã xoá profile "${key}"`
        + (rebound.length ? `; ${rebound.join(', ')} chuyển về "${DEFAULT_PROFILE_KEY}"` : ''),
    );
    return { rebound };
}
