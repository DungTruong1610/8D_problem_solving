// ── Local Common Components ───────────────────────────────────────────────────
export { AccessDenied } from './access-denied';
export { ErrorBoundary } from './error-boundary';

// ── Re-export UIs & Hooks from @cnma/cap-identity ─────────────────────────────
export {
    OrganizationManager,
    SupportTypesTab,
    UsersTab,
    GroupsTab,
    SamlMappingsTab,
    GroupMembersPanel,
    UserPreferencesDialog,
    UserPreferencesPage,
    createIdentityService,
    i18n as identityI18n,
} from '@cnma/cap-identity/react';

export type {
    UserPreferencesPageProps,
    SupportType,
    ShadowUser,
    ShadowGroup,
    GroupMember,
    SamlMapping,
    Theme,
    Language,
    UserSettings,
    IdentityHttpClient,
    OrganizationManagerProps,
    IdentityTabProps,
} from '@cnma/cap-identity/react';

// ── Re-export UIs & Hooks from @cnma/cap-valuehelp ────────────────────────────
export {
    ValueHelpSelect,
    ValueHelpComboBox,
    ValueHelpMultiSelect,
    ValueHelpSearchInput,
    SearchHelpDialog,
    ValueHelpManager,
    useValueHelp,
    useSearchHelp,
} from '@cnma/cap-valuehelp/react';

export type {
    ValueHelpManagerProps,
    ValueHelpManagerRef,
    ValueHelpEntry,
    ReturnMapping,
    SearchConfig,
    SearchField,
    ResultColumn,
    ValueHelpBaseProps,
    WithBatchUpdate,
    SearchHelpDialogProps,
    UseValueHelpReturn,
    UseValueHelpOptions,
    UseSearchHelpReturn,
    UseSearchHelpOptions,
} from '@cnma/cap-valuehelp/react';
