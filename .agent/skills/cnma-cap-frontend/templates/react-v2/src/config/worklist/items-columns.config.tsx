/**
 * Column definitions for the Items worklist table.
 *
 * Pattern (TanStack Table ColumnDef):
 *   - accessorKey: maps to entity field name
 *   - header: column label (i18n key or string)
 *   - cell: optional custom renderer
 *
 * ★ Replace "Items" with your actual entity name.
 *   Import and pass to your DataTable component as `columns`.
 */
import type { ColumnDef } from '@tanstack/react-table';

// ── Entity type — replace with your actual entity interface ───────────────────
export interface Item {
    ID: string;
    name: string;
    description?: string;
    status: string;
    priority: number;
    createdAt?: string;
    modifiedAt?: string;
}

// ── Column definitions ────────────────────────────────────────────────────────
export const itemsColumns: ColumnDef<Item>[] = [
    {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => (
            <span className="font-medium text-foreground">{getValue<string>()}</span>
        ),
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
            const status = getValue<string>();
            return (
                <span className={`
                    inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                    ${status === 'active' ? 'bg-status-done text-status-done-foreground' : ''}
                    ${status === 'pending' ? 'bg-status-pending text-status-pending-foreground' : ''}
                    ${status === 'inactive' ? 'bg-status-cancelled text-status-cancelled-foreground' : ''}
                `}>
                    {status}
                </span>
            );
        },
    },
    {
        accessorKey: 'priority',
        header: 'Priority',
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => (
            <span className="text-muted-foreground truncate max-w-xs block">{getValue<string>() || '-'}</span>
        ),
    },
];
