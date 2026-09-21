import React from 'react';
import { useWorklistViewModel } from './hooks/useWorklistViewModel';
import { FilterBar } from './components/FilterBar';
import { LogTable } from './components/LogTable';
import { ActionToolbar } from './components/ActionToolbar';
import { Card, CardContent } from '@/presentation/components/ui/card';
import { useTranslation } from 'react-i18next';
import { PayloadDialog } from './components/dialogs/PayloadDialog';
import { ErrorLogDialog } from './components/dialogs/ErrorLogDialog';
import { ReprocessConfirmDialog } from './components/dialogs/ReprocessConfirmDialog';
import { ReprocessByFilterConfirmDialog } from './components/dialogs/ReprocessByFilterConfirmDialog';
import { ActionResultDialog } from './components/dialogs/ActionResultDialog';

export const WorklistPage: React.FC = () => {
    const vm = useWorklistViewModel();

    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <h1 className="text-lg font-bold text-text-primary">{t('app.title')}</h1>
            </div>

            <FilterBar
                filters={vm.filters}
                onFilterChange={vm.handleFilterChange}
                onSearch={vm.handleSearch}
                availableObjectTypes={vm.availableObjectTypes}
            />

            <Card>
                <ActionToolbar
                    onExport={vm.handleExport}
                    onReprocessBulk={vm.handleReprocessBulk}
                    onReprocessByFilter={vm.handleReprocessByFilterRequest}
                    hasSelection={Object.keys(vm.rowSelection).length > 0}
                    isExporting={vm.isExporting}
                    isReprocessing={vm.isReprocessing}
                    totalCount={vm.totalCount}
                />
                <CardContent>
                    <LogTable
                        data={vm.logs}
                        isLoading={vm.isLoading}
                        onReprocess={vm.handleReprocessRequest}
                        onViewPayload={vm.handleViewPayload}
                        onViewError={vm.handleViewError}
                        onRowSelectionChange={vm.setRowSelection}
                        rowSelection={vm.rowSelection}
                    />

                    {/* Simple Pagination */}
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <div className="flex-1 text-sm text-muted-foreground">
                            {t('common.page')} {vm.page + 1}
                        </div>
                        <div className="space-x-2">
                            <button
                                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                                onClick={() => vm.setPage(old => Math.max(0, old - 1))}
                                disabled={vm.page === 0}
                            >
                                {t('common.previous')}
                            </button>
                            <button
                                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                                onClick={() => vm.setPage(old => old + 1)}
                                disabled={!vm.logs || vm.logs.length < vm.pageSize}
                            >
                                {t('common.next')}
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Dialogs */}
            <PayloadDialog
                open={vm.isPayloadOpen}
                onOpenChange={vm.setIsPayloadOpen}
                payload={vm.selectedLog?.payload}
            />
            <ErrorLogDialog
                open={vm.isErrorOpen}
                onOpenChange={vm.setIsErrorOpen}
                errorDetail={vm.selectedLog?.messageDetail}
            />
            <ReprocessConfirmDialog
                open={vm.isConfirmOpen}
                onOpenChange={vm.setIsConfirmOpen}
                onConfirm={vm.handleConfirmReprocess}
                recordId={vm.selectedLog?.ID as any}
            />
            <ReprocessByFilterConfirmDialog
                open={vm.isReprocessByFilterConfirmOpen}
                onOpenChange={vm.setIsReprocessByFilterConfirmOpen}
                onConfirm={vm.handleReprocessByFilter}
            />
            <ActionResultDialog
                open={vm.actionResult.open}
                onOpenChange={(open) => vm.setActionResult(prev => ({ ...prev, open }))}
                type={vm.actionResult.type}
                title={vm.actionResult.title}
                message={vm.actionResult.message}
            />
        </div>
    );
};
