import { ReactNode } from 'react';

interface Column<T> {
    key: keyof T | string;
    header: string;
    width?: string;
    render?: (row: T, index: number) => ReactNode;
}

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
    isLoading?: boolean;
}

export function Table<T extends { ID?: string; id?: string }>({
    columns,
    data,
    onRowClick,
    emptyMessage = 'No data available',
    isLoading = false,
}: TableProps<T>) {
    const getRowKey = (row: T, index: number) => {
        return row.ID || row.id || `row-${index}`;
    };

    const getCellValue = (row: T, key: keyof T | string): ReactNode => {
        const keys = (key as string).split('.');
        let value: any = row;
        for (const k of keys) {
            value = value?.[k];
        }
        return value ?? '-';
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="animate-pulse">
                    <div className="h-12 bg-gray-100 border-b border-gray-200" />
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 border-b border-gray-100 flex items-center px-4 gap-4">
                            <div className="h-4 bg-gray-200 rounded w-1/4" />
                            <div className="h-4 bg-gray-100 rounded w-1/3" />
                            <div className="h-4 bg-gray-100 rounded w-1/5" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {columns.map((col) => (
                                <th
                                    key={col.key as string}
                                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                                    style={{ width: col.width }}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, index) => (
                                <tr
                                    key={getRowKey(row, index)}
                                    onClick={() => onRowClick?.(row)}
                                    className={`
                                        transition-colors duration-150
                                        ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                                    `}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key as string}
                                            className="px-4 py-4 text-sm text-gray-700"
                                        >
                                            {col.render
                                                ? col.render(row, index)
                                                : getCellValue(row, col.key)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
