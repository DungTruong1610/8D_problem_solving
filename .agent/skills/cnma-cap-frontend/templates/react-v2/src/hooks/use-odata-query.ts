import {
    useQuery,
    useMutation,
    useInfiniteQuery,
    useQueryClient,
    type UseQueryOptions,
    type UseMutationOptions,
    type QueryKey,
    type InfiniteData,
} from '@tanstack/react-query';

/**
 * Thin wrapper around useQuery with sensible OData defaults (5-min staleTime).
 *
 * Usage:
 *   const { data, isLoading } = useODataQuery(
 *     ['items'],
 *     () => api.get('./api/cnma/reactdemo/Items').then(r => r.data)
 *   );
 */
export function useODataQuery<T = unknown, TError = Error, TData = T>(
    queryKey: QueryKey,
    queryFn: () => Promise<T>,
    options?: Omit<UseQueryOptions<T, TError, TData, QueryKey>, 'queryKey' | 'queryFn'>
) {
    return useQuery<T, TError, TData, QueryKey>({
        queryKey,
        queryFn,
        staleTime: 5 * 60 * 1000,
        ...options,
    });
}

/** OData page response shape (V4 with $count) */
export interface ODataPageResponse<T> {
    value: T[];
    '@odata.count'?: number;
}

/**
 * Infinite scroll hook for OData paged endpoints using $top/$skip.
 *
 * Usage:
 *   const { data, fetchNextPage, hasNextPage } = useInfiniteODataQuery(
 *     ['items'],
 *     (page) => api.get(`./api/cnma/reactdemo/Items?$top=20&$skip=${(page-1)*20}`).then(r => r.data)
 *   );
 */
export function useInfiniteODataQuery<T = unknown, TError = Error>(
    queryKey: QueryKey,
    queryFn: (page: number) => Promise<ODataPageResponse<T>>,
    options?: {
        pageSize?: number;
        staleTime?: number;
        enabled?: boolean;
        refetchInterval?: number | false;
    }
) {
    const pageSize = options?.pageSize ?? 20;

    return useInfiniteQuery<
        ODataPageResponse<T>,
        TError,
        InfiniteData<ODataPageResponse<T>>,
        QueryKey,
        number
    >({
        queryKey,
        queryFn: ({ pageParam }) => queryFn(pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage?.value) return undefined;
            const totalCount = lastPage['@odata.count'];
            const loadedCount = allPages.reduce((sum, page) => sum + (page.value?.length ?? 0), 0);
            if (totalCount !== undefined) return loadedCount < totalCount ? allPages.length + 1 : undefined;
            return lastPage.value.length >= pageSize ? allPages.length + 1 : undefined;
        },
        staleTime: options?.staleTime ?? 5 * 60 * 1000,
        enabled: options?.enabled,
        refetchInterval: options?.refetchInterval,
    });
}

/**
 * Mutation wrapper that auto-invalidates all queries on success.
 */
export function useODataMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'>
) {
    const queryClient = useQueryClient();

    return useMutation<TData, TError, TVariables, TContext>({
        mutationFn,
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries();
            options?.onSuccess?.(data, variables, context);
        },
        ...options,
    });
}
