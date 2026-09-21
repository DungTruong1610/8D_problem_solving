/**
 * Filter bar configuration for the Items worklist.
 *
 * Pattern: define filters as an array of FilterField objects.
 * Each field maps to a @cnma/react-ui FilterBar field.
 *
 * ★ Replace with your entity's actual filterable fields.
 */
import type { FilterField } from '@cnma/react-ui';

export const itemsFilterConfig: FilterField[] = [
    {
        key: 'name',
        label: 'Name',
        type: 'text',
        placeholder: 'Search by name...',
    },
    {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
            { value: 'active',   label: 'Active' },
            { value: 'pending',  label: 'Pending' },
            { value: 'inactive', label: 'Inactive' },
        ],
    },
    {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: [
            { value: '1', label: 'High' },
            { value: '2', label: 'Medium' },
            { value: '3', label: 'Low' },
        ],
    },
];
