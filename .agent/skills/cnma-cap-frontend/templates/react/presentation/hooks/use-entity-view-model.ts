/**
 * useViewModel — Hook pattern that connects UseCases to React components.
 *
 * CONVENTION:
 * - Place in src/presentation/hooks/
 * - One hook per page/feature (not per component)
 * - Encapsulates: loading state, error state, data, and actions
 * - Components only call hook methods, never UseCases directly
 *
 * WHY: Keeps components purely presentational. All logic flows through:
 *   Component → useViewModel hook → UseCase → Repository → API
 *
 * USAGE:
 *   function MyPage() {
 *       const { data, isLoading, error, refresh, create } = useMyViewModel();
 *       if (isLoading) return <Spinner />;
 *       if (error) return <ErrorBanner message={error} />;
 *       return <MyList items={data} onCreate={create} />;
 *   }
 */
import { useState, useEffect, useCallback } from "react";
import { container } from "../../di/container";

interface ViewModelState<T> {
    data: T[];
    isLoading: boolean;
    error: string | null;
}

export function useEntityViewModel<T>() {
    const [state, setState] = useState<ViewModelState<T>>({
        data: [],
        isLoading: true,
        error: null,
    });

    const repository = container.entityRepository;

    const fetchData = useCallback(async () => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        try {
            const data = await repository.getAll() as T[];
            setState({ data, isLoading: false, error: null });
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: err.message || "Failed to fetch data",
            }));
        }
    }, [repository]);

    const create = useCallback(async (entity: Partial<T>) => {
        try {
            await repository.create(entity);
            await fetchData(); // Refresh list after creation
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                error: err.message || "Failed to create entity",
            }));
        }
    }, [repository, fetchData]);

    const remove = useCallback(async (id: string) => {
        try {
            await repository.delete(id);
            await fetchData(); // Refresh list after deletion
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                error: err.message || "Failed to delete entity",
            }));
        }
    }, [repository, fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        ...state,
        refresh: fetchData,
        create,
        remove,
    };
}
