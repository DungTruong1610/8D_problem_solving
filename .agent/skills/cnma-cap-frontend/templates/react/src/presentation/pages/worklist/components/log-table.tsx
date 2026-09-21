import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/presentation/components/ui/table"
import { Button } from "@/presentation/components/ui/button"
import type { LogRecord } from '@/domain/entities/LogRecord';
import { format } from 'date-fns';
import { Constants } from '@/core/Constants';

interface LogTableProps {
    data: LogRecord[];
    onReprocess: (id: string) => void;
    onViewPayload: (log: LogRecord) => void;
    onViewError: (log: LogRecord) => void;
    isLoading: boolean;
    onRowSelectionChange: (selection: any) => void;
    rowSelection: any;
}

export const LogTable: React.FC<LogTableProps> = ({ data, onReprocess, onViewPayload, onViewError, isLoading, onRowSelectionChange, rowSelection }) => {

    const { t } = useTranslation();

    const columns: ColumnDef<LogRecord>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                />
            ),
        },
        {
            accessorKey: 'objectType',
            header: t('logTable.headers.objectType'),
        },
        {
            accessorKey: 'objectKey',
            header: t('logTable.headers.objectKey'),
        },
        {
            accessorKey: 'objectProcessingTimestamp',
            header: t('logTable.headers.processingTime'),
            cell: ({ getValue }) => {
                const val = getValue() as string;
                return val ? format(new Date(val), 'dd/MM/yyyy HH:mm:ss') : '-';
            }
        },
        {
            accessorKey: 'eventStatus',
            header: t('logTable.headers.status'),
            cell: ({ getValue }) => {
                const status = getValue() as string;
                let className = "text-xs font-semibold px-2 py-0.5 rounded-full border ";
                let label = status;

                if (status === Constants.LOG_EVENT_STATUS.ERROR) {
                    className += "bg-red-100 text-red-700 border-red-200";
                    label = t('logTable.status.error');
                }
                else if (status === Constants.LOG_EVENT_STATUS.SUCCESS) {
                    className += "bg-green-100 text-green-700 border-green-200";
                    label = t('logTable.status.success');
                }
                else if (status === Constants.LOG_EVENT_STATUS.WARNING) {
                    className += "bg-orange-100 text-orange-800 border-orange-200";
                    label = t('logTable.status.warning');
                }
                else {
                    className += "bg-slate-100 text-slate-700 border-slate-200";
                }

                return <span className={className}>{label}</span>;
            }
        },
        {
            accessorKey: 'eventType',
            header: t('logTable.headers.eventType'),
        },
        {
            accessorKey: 'messageDetail',
            header: "Message Log",
            cell: ({ getValue, row }) => {
                const val = getValue() as string;
                if (!val) return <span className="text-text-secondary">-</span>;

                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-text-secondary truncate max-w-[150px]" title={val}>
                            {val}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                            onClick={() => onViewError(row.original)}
                            title={t('logTable.actions.viewError')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </Button>
                    </div>
                );
            }
        },
        {
            accessorKey: 'erpSystemId',
            header: t('logTable.headers.systemId'),
        },
        {
            id: 'actions',
            header: t('logTable.headers.actions'),
            cell: ({ row }) => {
                const log = row.original;
                const canReprocess = Constants.RE_PROCESS_ALLOW_STATUSES.includes(log.eventStatus as any);
                const hasError = log.eventStatus === Constants.LOG_EVENT_STATUS.ERROR;

                return (
                    <div className="flex gap-1 items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
                            onClick={() => onViewPayload(log)}
                            title={t('logTable.actions.viewPayload')}
                        >
                            {t('logTable.actions.viewPayload')}
                        </Button>

                        {hasError && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-red-600 hover:text-red-800 hover:bg-red-50 px-2"
                                onClick={() => onViewError(log)}
                                title={t('logTable.actions.viewError')}
                            >
                                {t('logTable.actions.viewError')}
                            </Button>
                        )}

                        {canReprocess && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-2"
                                onClick={() => onReprocess(log.ID)}
                            >
                                {t('logTable.actions.reprocess')}
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: {
            rowSelection,
        },
        onRowSelectionChange: onRowSelectionChange,
        enableRowSelection: true,
    });

    if (isLoading) {
        return <div className="p-4 text-center">Loading logs...</div>;
    }

    return (
        <div className="rounded-md border bg-white">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center"
                            >
                                {t('common.noResults')}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
