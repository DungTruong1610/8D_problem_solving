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

function toDisplayName(info: UserInfoResponse): string {
    return info.displayName || info.name || info.email || info.id || 'User';
}

function toInitials(displayName: string): string {
    const parts = displayName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

/**
 * Hook to fetch and derive the current user's information from the CAP backend.
 * Replace the endpoint with your project's user info endpoint.
 */
export function useUserInfo() {
    const { data, isLoading } = useQuery<UserInfoResponse>({
        queryKey: ['userInfo'],
        queryFn: async () => {
            const response = await api.get<UserInfoResponse>('./api/user-info');
            return response.data;
        },
        staleTime: 30 * 60 * 1000, // 30 minutes
        retry: false,
    });

    const displayName = data ? toDisplayName(data) : '';
    const initials = toInitials(displayName);
    const isAdmin = data?.roles?.includes('admin') ?? false;

    const userInfo: UserInfo = {
        id: data?.id ?? '',
        name: data?.name ?? '',
        email: data?.email ?? '',
        displayName,
        initials,
        isAdmin,
    };

    return { userInfo, isLoading };
}
