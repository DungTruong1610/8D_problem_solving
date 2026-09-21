import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: (failureCount, error) => {
                // Never retry 403 — authorization issue, not transient
                if ((error as any)?.response?.status === 403) return false;
                return failureCount < 1;
            },
            refetchOnWindowFocus: false,
        },
    },
});
