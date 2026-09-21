import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    getLibraryCases, getProfileCriteria, getProfiles,
    type LibraryCase, type RetrievalSettings, type SimilarityCriterion,
} from '@/services/retrieval-service';

/**
 * Trạng thái cấu hình tìm tiền lệ, dùng chung cho AI Settings và trang Workflow.
 *
 * ── Vì sao gom vào một hook ──
 * Hai trang hiển thị CÙNG một cấu hình theo hai cách sắp xếp khác nhau: một bên
 * nhóm theo chủ đề, một bên đi theo thứ tự quy trình. Nếu mỗi trang tự quản lý
 * state thì sớm muộn chúng lệch nhau — sửa ở trang này, trang kia vẫn hiện số cũ.
 *
 * ── Vì sao mọi thao tác ghi đều nạp lại cả bộ ──
 * Trần điểm phụ thuộc MỌI tiêu chí đang bật, nên đổi một dòng là đổi con số của
 * cả bảng. Cập nhật cục bộ sẽ cho ra một trần sai mà nhìn không biết.
 *
 * ── Vì sao đọc profile `default` chứ không bảng cấu hình toàn cục ──
 * Trọng số chấm điểm giờ thuộc về profile, và mỗi bước D chạy profile của riêng
 * nó — xem trang Object Schema. Bảng toàn cục cũ chỉ còn là nguồn để dựng profile
 * `default` một lần lúc migrate; đọc nó ở đây nghĩa là hai trang hiện hai con số
 * cho cùng một thứ, và trang này sẽ hiện con số không còn ai dùng.
 *
 * Hook này cố ý CHỈ nói về profile mặc định: nó phục vụ hai màn hình tổng quan,
 * và tổng quan theo tám profile là việc của trang Object Schema.
 */
export const DEFAULT_PROFILE_KEY = 'default';
export interface RetrievalConfigState {
    criteria: SimilarityCriterion[];
    settings: RetrievalSettings | null;
    cases: LibraryCase[];
    loading: boolean;
    /** Khoá đang được ghi, hoặc null. Dùng để vô hiệu hoá đúng chỗ đang bận. */
    busy: string | null;
    reload: () => Promise<void>;
    /** Chạy một thao tác ghi rồi nạp lại; lỗi thì báo và nạp lại để bỏ thay đổi hỏng. */
    run: (key: string, fn: () => Promise<unknown>) => Promise<void>;

    // ── Số liệu dẫn xuất, tính một chỗ để hai trang không lệch nhau ──
    maxScore: number;
    enabledCount: number;
    embeddedCount: number;
    notEmbedded: number;
    embeddingModel: string | null;
    hasVectorStep: boolean;

    /** Profile mà state này đang nói về. Mọi thao tác ghi phải dùng khoá này. */
    profileKey: string;
}

/**
 * @param profileKey profile cần đọc. Bỏ trống ⇒ profile mặc định.
 *
 * Tham số này tồn tại để tab "Similarity search" của từng bước D dùng lại đúng
 * những section mà Training Center dùng, chỉ khác profile. Viết một bộ section
 * thứ hai cho từng bước là hai bản sao của cùng một màn hình, và chúng sẽ lệch.
 */
export function useRetrievalConfig(profileKey: string = DEFAULT_PROFILE_KEY): RetrievalConfigState {
    const [criteria, setCriteria] = useState<SimilarityCriterion[]>([]);
    const [settings, setSettings] = useState<RetrievalSettings | null>(null);
    const [cases, setCases] = useState<LibraryCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    // Khoá THỰC SỰ đang được đọc. Khác `profileKey` khi profile đó đã bị xoá —
    // ghi bằng khoá không tồn tại sẽ ném 404 mà không rõ vì sao.
    const [resolvedKey, setResolvedKey] = useState(profileKey);

    const reload = useCallback(async () => {
        const [allCriteria, profiles, l] = await Promise.all([
            getProfileCriteria(), getProfiles(), getLibraryCases(),
        ]);
        const profile = profiles.find((p) => p.profileKey === profileKey)
            ?? profiles.find((p) => p.profileKey === DEFAULT_PROFILE_KEY)
            ?? profiles[0]
            ?? null;
        setResolvedKey(profile?.profileKey ?? DEFAULT_PROFILE_KEY);

        setCriteria(
            allCriteria
                .filter((c) => c.profile_profileKey === profile?.profileKey)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        );
        setSettings(profile
            ? {
                ID: profile.profileKey,
                minScore: profile.minScore,
                topN: profile.topN,
                closedOnly: profile.closedOnly,
            }
            : null);
        setCases(l);
    }, [profileKey]);

    useEffect(() => {
        reload()
            .catch((e: any) => toast.error(`Could not load retrieval configuration: ${e.message}`))
            .finally(() => setLoading(false));
    }, [reload]);

    const run = useCallback(async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key);
        try {
            await fn();
            await reload();
        } catch (e: any) {
            toast.error(`Save failed: ${e?.response?.data?.error?.message ?? e.message}`);
            // Nạp lại kể cả khi lỗi: ô nhập đang giữ giá trị người dùng vừa gõ,
            // mà DB thì không nhận — để nguyên là hiện một trạng thái không có thật.
            await reload().catch(() => undefined);
        } finally {
            setBusy(null);
        }
    }, [reload]);

    const enabled = criteria.filter((c) => c.enabled);
    const embedded = cases.filter((c) => c.embeddingModel);

    return {
        criteria,
        settings,
        cases,
        loading,
        busy,
        reload,
        run,
        maxScore: enabled.reduce((s, c) => s + (c.weight ?? 0), 0),
        enabledCount: enabled.length,
        embeddedCount: embedded.length,
        notEmbedded: cases.length - embedded.length,
        embeddingModel: embedded[0]?.embeddingModel ?? null,
        hasVectorStep: enabled.some((c) => c.matchType === 'cosine'),
        profileKey: resolvedKey,
    };
}
