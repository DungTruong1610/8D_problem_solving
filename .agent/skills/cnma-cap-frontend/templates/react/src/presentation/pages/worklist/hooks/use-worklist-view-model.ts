import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GetLogsUseCase, type GetLogsRequest } from '@/domain/usecases/GetLogsUseCase';
import { ReprocessLogUseCase } from '@/domain/usecases/ReprocessLogUseCase';
import { LogRepository } from '@/data/repositories/LogRepository';
import type { LogRecord } from '@/domain/entities/LogRecord';

// Instantiating UseCases here (In a real app, use DI container)
const logRepository = new LogRepository();
const getLogsUseCase = new GetLogsUseCase(logRepository);
const reprocessLogUseCase = new ReprocessLogUseCase(logRepository);

export const useWorklistViewModel = () => {
    // ViewModel Hook for Worklist Page
    const queryClient = useQueryClient();

    // State
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState<GetLogsRequest['filters']>({});
    const [sorting, setSorting] = useState<{ field: string; order: 'asc' | 'desc' } | undefined>(undefined);
    const [selectedLogs, setSelectedLogs] = useState<LogRecord[]>([]);

    // Available Object Types
    const [availableObjectTypes, setAvailableObjectTypes] = useState<string[]>([]);

    useEffect(() => {
        const fetchTypes = async () => {
            const result = await logRepository.getObjectTypes();
            if (result.isSuccess) {
                setAvailableObjectTypes(result.getValue());
            }
        };
        fetchTypes();
    }, []);

    // Query
    // Query
    const {
        data,
        isLoading,
        isError,
        error,
        refetch
    } = useQuery({
        queryKey: ['logs', page, pageSize, filters, sorting],
        queryFn: async () => {
            const result = await getLogsUseCase.execute({
                page,
                pageSize,
                filters,
                sorting
            });

            if (result.isFailure) {
                throw new Error(result.error);
            }
            return result.getValue();
        },
        placeholderData: (previousData) => previousData // Keep prev data while fetching
    });

    // Mutations
    const reprocessMutation = useMutation({
        mutationFn: async (id: string) => {
            const result = await reprocessLogUseCase.execute({ id });
            if (result.isFailure) throw new Error(result.error);
            return result.getValue();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['logs'] });
        }
    });

    // Handlers
    const handleSearch = useCallback(() => {
        setPage(0); // Reset to first page
        refetch();
    }, [refetch]);

    const handleFilterChange = useCallback((newFilters: any) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    const handleSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
        setSorting({ field, order });
    }, []);

    const handleReprocess = async (id: string) => {
        try {
            await reprocessMutation.mutateAsync(id);
            // Show Success Toast
        } catch (e) {
            // Show Error Toast
            console.error(e);
        }
    };

    // Dialog State
    const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
    const [isPayloadOpen, setIsPayloadOpen] = useState(false);
    const [isErrorOpen, setIsErrorOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [reprocessId, setReprocessId] = useState<string | null>(null);

    // New Dialogs
    const [isReprocessByFilterConfirmOpen, setIsReprocessByFilterConfirmOpen] = useState(false);
    const [actionResult, setActionResult] = useState<{ open: boolean, type: 'success' | 'error' | 'info', title?: string, message: string }>({
        open: false,
        type: 'info',
        message: ''
    });

    // Dialog Handlers
    const handleViewPayload = useCallback((log: LogRecord) => {
        setSelectedLog(log);
        setIsPayloadOpen(true);
    }, []);

    const handleViewError = useCallback((log: LogRecord) => {
        setSelectedLog(log);
        setIsErrorOpen(true);
    }, []);

    const handleReprocessRequest = useCallback((id: string) => {
        setReprocessId(id);
        setIsConfirmOpen(true);
    }, []);

    const handleConfirmReprocess = async () => {
        setIsConfirmOpen(false);
        try {
            if (reprocessId) {
                // Single 
                await handleReprocess(reprocessId);
                setReprocessId(null);
                setActionResult({
                    open: true,
                    type: 'success',
                    message: 'Reprocessing triggered successfully.'
                });
            } else {
                // Bulk (from selection)
                const selectedIndices = Object.keys(rowSelection).map(Number);
                const selectedIds = selectedIndices.map(index => data?.data[index]?.ID).filter(Boolean);

                if (selectedIds.length > 0) {
                    await Promise.all(selectedIds.map(id => reprocessMutation.mutateAsync(id as string)));
                    setRowSelection({});
                    setActionResult({
                        open: true,
                        type: 'success',
                        message: `Batch reprocessing triggered for ${selectedIds.length} items.`
                    });
                }
            }
        } catch (e) {
            console.error(e);
            setActionResult({
                open: true,
                type: 'error',
                title: 'Reprocessing Failed',
                message: 'An error occurred while reprocessing.'
            });
        }
    };

    // Selection
    const [rowSelection, setRowSelection] = useState({});

    // Bulk Reprocess
    const handleReprocessBulk = async () => {
        const selectedIndices = Object.keys(rowSelection).map(Number);
        const selectedIds = selectedIndices.map(index => data?.data[index]?.ID).filter(Boolean);

        if (selectedIds.length === 0) return;

        setIsConfirmOpen(true);
    };

    const downloadCsv = (logs: LogRecord[]) => {
        if (!logs.length) return;

        const headers = ['ID', 'ObjectType', 'ObjectKey', 'Status', 'Message', 'Timestamp'];
        const csvContent = [
            headers.join(','),
            ...logs.map(log => {
                return [
                    log.ID,
                    log.objectType,
                    log.objectKey,
                    log.eventStatus,
                    `"${(log.messageDetail || '').replace(/"/g, '""')}"`,
                    log.objectProcessingTimestamp
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_export_${new Date().toISOString()}.csv`;
        a.click();
    };

    // Reprocess By Filter
    const handleReprocessByFilterRequest = useCallback(() => {
        setIsReprocessByFilterConfirmOpen(true);
    }, []);

    const handleReprocessByFilter = async () => {
        setIsReprocessByFilterConfirmOpen(false);

        try {
            // Construct filter string same as export
            let filterParts: string[] = [];
            if (filters?.objectType?.length) {
                const types = filters.objectType.map((t: string) => `objectType eq '${t}'`).join(' or ');
                filterParts.push(`(${types})`);
            }
            if (filters?.objectKey) filterParts.push(`contains(objectKey, '${filters.objectKey}')`);
            if (filters?.status) filterParts.push(`eventStatus eq '${filters.status}'`);

            const filterString = filterParts.join(' and ');
            await logRepository.reprocessByFilter(filterString);

            setActionResult({
                open: true,
                type: 'success',
                title: 'Mass Reprocessing Triggered',
                message: 'All matching items have been scheduled for reprocessing.'
            });
            refetch(); // Refresh list
        } catch (e) {
            console.error(e);
            setActionResult({
                open: true,
                type: 'error',
                title: 'Reprocessing Failed',
                message: 'An error occurred while triggering mass reprocessing.'
            });
        }
    };

    const [isExporting, setIsExporting] = useState(false);

    // Export
    const handleExport = async () => {
        setIsExporting(true);
        try {
            let filterParts: string[] = [];
            if (filters?.objectType?.length) {
                const types = filters.objectType.map((t: string) => `objectType eq '${t}'`).join(' or ');
                filterParts.push(`(${types})`);
            }
            if (filters?.objectKey) filterParts.push(`contains(objectKey, '${filters.objectKey}')`);
            if (filters?.status) filterParts.push(`eventStatus eq '${filters.status}'`);

            const filterString = filterParts.join(' and ');
            const result = await logRepository.exportData(filterString);

            if (result.isFailure) throw new Error(result.error);

            const logs = result.getValue();
            downloadCsv(logs);

        } catch (e) {
            console.error(e);
            alert("Export failed");
        } finally {
            setIsExporting(false);
        }
    };

    return {
        // Data
        logs: data?.data || [],
        totalCount: data?.count || 0,
        isLoading,
        isError,
        error,

        // State
        page,
        pageSize,
        filters,
        sorting,
        selectedLogs,
        rowSelection,

        // Dialog State exposed
        selectedLog,
        isPayloadOpen,
        setIsPayloadOpen,
        isErrorOpen,
        setIsErrorOpen,
        isConfirmOpen,
        setIsConfirmOpen,

        // Actions
        setPage,
        setPageSize,
        setSelectedLogs,
        setRowSelection,
        handleSearch,
        handleFilterChange,
        handleSortChange,
        handleReprocess,
        handleReprocessRequest,
        handleConfirmReprocess,
        handleViewPayload,
        handleViewError,
        handleReprocessBulk,
        handleReprocessByFilter,
        handleReprocessByFilterRequest,
        handleExport,

        // New Dialog Props
        isReprocessByFilterConfirmOpen,
        setIsReprocessByFilterConfirmOpen,
        actionResult,
        setActionResult,
        availableObjectTypes,

        isReprocessing: reprocessMutation.isPending,
        isExporting
    };
};
