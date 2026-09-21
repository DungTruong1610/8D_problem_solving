// VariantSettings - User variant preferences for worklists
// Used for storing user-specific display configurations (filters, columns, sorting)
// Namespace will be replaced during project generation: {{namespace}}

namespace {{namespace}};

using {
    managed,
    cuid
} from '@sap/cds/common';

@cds.persistence.exists
entity VariantSettings : cuid, managed {
    variantKey         : String(100) not null;
    variantName        : String(200) not null;
    workListId         : String(100) not null;
    isDefaultVariant   : Boolean default false;
    isGlobalVariant    : Boolean default false;
    filterBarVariant   : String(500);
    filterDataVariant  : String(500);
    tableColumnVariant : String(1000);
    tableSortVariant   : String(500);
    tableGroupVariant  : String(500);
}