import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface UserInfo {
    id: string;
    name: string;
    email: string;
    displayName: string;
    initials: string;
    isAdmin: boolean;
}

interface UserInfoResponse {
    id?: string;
    name?: string;
    email?: string;
    displayName?: string;
    roles?: string[];
}

const isLocal = typeof window !== 'undefined' && (
    (import.meta as any).env?.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
);

function toDisplayName(info: UserInfoResponse): string {
    return info.displayName || info.name || info.email || info.id || (isLocal ? 'Local Developer' : 'User');
}

function toInitials(displayName: string): string {
    const parts = displayName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return isLocal ? 'LD' : 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

/**
 * Hook to fetch and derive the current user's information from the CAP backend.
 * Uses 'Local Developer' and Admin privileges in local development,
 * and real XSUAA user info & strict roles on SAP BTP production.
 */
export function useUserInfo() {
    const { data, isLoading } = useQuery<UserInfoResponse>({
        queryKey: ['userInfo'],
        queryFn: async () => {
            try {
                const response = await api.get<any>('/api/cnma/IDENTITY_USER_SRV/me()');
                const raw = response.data?.value || response.data;
                if (!raw || typeof raw !== 'object') return {};

                const isAdmin = Boolean(raw.isAdmin);
                const displayName = raw.displayName ||
                    (raw.firstName && raw.lastName ? `${raw.firstName} ${raw.lastName}`.trim() : raw.email);

                return {
                    id: raw.ID || raw.userId || raw.id,
                    name: displayName,
                    displayName,
                    email: raw.email,
                    roles: isAdmin ? ['admin', 'Admin', 'authenticated-user'] : ['authenticated-user'],
                };
            } catch {
                if (isLocal) {
                    return {
                        id: 'developer',
                        name: 'Local Developer',
                        displayName: 'Local Developer',
                        email: 'developer@local.dev',
                        roles: ['admin', 'Admin', 'authenticated-user'],
                    };
                }
                return {};
            }
        },
        staleTime: 30 * 60 * 1000, // 30 minutes
        retry: false,
    });

    const displayName = data ? toDisplayName(data) : (isLocal ? 'Local Developer' : 'User');
    const initials = toInitials(displayName);
    const isAdmin = data?.roles?.some((r) => r.toLowerCase() === 'admin') ?? (isLocal ? true : false);

    const userInfo: UserInfo = {
        id: data?.id ?? (isLocal ? 'developer' : ''),
        name: data?.name ?? (isLocal ? 'Local Developer' : ''),
        email: data?.email ?? (isLocal ? 'developer@local.dev' : ''),
        displayName,
        initials,
        isAdmin,
    };

    return { userInfo, isLoading };
}
