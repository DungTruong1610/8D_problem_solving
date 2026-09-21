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
export const itemsColumns: any[] = [
    {
        accessorKey: 'name',
        header: 'Name',
        cell: (info: any) => (
            <span className="font-medium text-foreground">{String(info.getValue?.() ?? info.value ?? '')}</span>
        ),
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: (info: any) => {
            const status = String(info.getValue?.() ?? info.value ?? '');
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
        cell: (info: any) => (
            <span className="text-muted-foreground truncate max-w-xs block">{String(info.getValue?.() ?? info.value ?? '-') || '-'}</span>
        ),
    },
    {
        accessorKey: 'createdBy',
        header: 'Created By',
        cell: (info: any) => {
            const row = info.row?.original || {};
            return (
                <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">{row.createdBy || String(info.getValue?.() ?? '') || '—'}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{row.createdAt ? new Date(row.createdAt).toLocaleString('en-GB') : '—'}</div>
                </div>
            );
        },
    },
    {
        accessorKey: 'modifiedBy',
        header: 'Last Updated By',
        cell: (info: any) => {
            const row = info.row?.original || {};
            return (
                <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">{row.modifiedBy || row.createdBy || '—'}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{row.modifiedAt ? new Date(row.modifiedAt).toLocaleString('en-GB') : (row.createdAt ? new Date(row.createdAt).toLocaleString('en-GB') : '—')}</div>
                </div>
            );
        },
    },
];
