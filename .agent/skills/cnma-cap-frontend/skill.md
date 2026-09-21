---
name: cnma-cap-frontend
description: Add the frontend (App + UI Deployer) to a SAP CAP project following Conarum standards. Supports UI5 Freestyle and React Clean Architecture.
---

# CNMA CAP Frontend Skill

## Purpose
Scaffold the **frontend layer** of a SAP CAP project. Supports two architectures:
1. **SAP UI5 / Fiori Freestyle** — Standard SAPUI5 with handler delegation pattern
2. **React Clean Architecture** — Modern React with layered domain architecture

#### `vite.config.ts` Pattern (react-v2 — Tailwind v4)
Uses `@tailwindcss/vite` plugin. **No `postcss.config` or `tailwind.config.js` needed.**
```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',     // CRITICAL: Forces relative paths for BTP Workzone
  plugins: [
    react(),
    tailwindcss(), // Tailwind v4 — replaces postcss.config entirely
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: {
      '/odata': { target: 'http://localhost:4004', headers: { Authorization: 'Basic YWRtaW46' } },
      '/api/cnma': { target: 'http://localhost:4004', headers: { Authorization: 'Basic YWRtaW46' } },
    }
  }
})
```

### 6.2 Filter Components
Reuse these components for consistent filter UI:

#### `src/presentation/components/filters/MultiComboboxFilter.tsx`
> **Template**: `templates/react/presentation/components/filters/MultiComboboxFilter.tsx`

#### `src/presentation/components/filters/ComboboxFilter.tsx`
For single select with search:
> **Template**: `templates/react/presentation/components/filters/ComboboxFilter.tsx`

#### `src/presentation/components/filters/DateRangeFilter.tsx`
> **Template**: `templates/react/presentation/components/filters/DateRangeFilter.tsx`

#### `FilterBar.tsx` Pattern
> **Template**: `templates/react/presentation/components/FilterBar.tsx`

### 6.3 Excel Export (Client-Side)
Use `xlsx` (SheetJS) to export data on the client side. Handle UPPERCASE column names from CAP:

```typescript
// in ViewModel
const downloadExcel = (records: any[]) => {
    import('xlsx').then(XLSX => {
        const worksheetData = records.map(rec => ({
            'Column 1': rec.prop1 || rec.PROP1, // Handle Case Sensitivity
            'Column 2': rec.prop2 || rec.PROP2,
        }));
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        XLSX.writeFile(workbook, `Export_${new Date().toISOString()}.xlsx`);
    });
};
```

## 7. Best Practices
- **Clean Architecture**: Strict separation between Presentation, Domain, Data.
- **IoC**: Use `useWorklistViewModel` to wire Repositories and UseCases.
- **Reusable UI**: Extract complex UI logic (like Filters) into separate components.

## When to Use
- Adding a UI module to an existing CAP backend
- Creating a Full CAP project (called by `/init_cap_project` workflow)
- The user must specify **React** or **UI5** when prompted

---

## BTP Workzone Routing & Router Choice (CRITICAL)

When the React app is deployed to SAP Build Workzone (Managed AppRouter), it gets served from a dynamic, unique path URL that contains an App ID and version string (e.g., `.../~42891fac-0bbe-4c6d-a7df-13fa2a39e42f~/index.html`). 

**You MUST adhere to these two rules to prevent breaking API calls on BTP:**

1. **Use `HashRouter`, NEVER `BrowserRouter`**:
   `BrowserRouter` will overwrite the URL in the browser address bar to `/dashboard`, erasing the `~42891fac...~` prefix. When the app makes an API request, it will incorrectly hit the root domain (`https://host.com/api/...`) instead of the app's internal router path. `HashRouter` appends `#/dashboard`, preserving the Workzone prefix.

2. **Use Relative `baseURL` Paths**:
   Your OData URLs MUST use relative paths (e.g., `./api/cnma/LOG_SRV`). Do NOT use absolute paths (`/api/cnma/...`). A relative path ensures the HTML5 App Repo dynamically resolves the API call against the preserved `~42891fac...~` prefix.

---

## Namespace Convention (CRITICAL)

The **namespace** is passed from the `/init_cap_project` workflow. The agent MUST ask for it if not provided.

**UI5 Namespace** = base namespace with dots replaced by `/`, plus `/app`.

| Base Namespace | UI5 Namespace | Used In |
|---------------|--------------|--------|
| `cnma.notification` | `cnma/notification/app` | `manifest.json`, `Component.js`, `index.html`, all `sap.ui.define` paths |
| `cnma.sustainability.main` | `cnma/sustainability/main` | Same places |

**Where namespace appears in UI5:**
- `manifest.json` → `"sap.app": { "id": "{{ui_namespace}}" }`
- `Component.js` → `UIComponent.extend("{{ui_namespace}}.Component", { ... })`
- `index.html` → `data-sap-ui-resourceroots='{"{{ui_namespace}}": "./"}'`
- Every `sap.ui.define` → `"{{ui_namespace}}/controller/BaseController"`, `"{{ui_namespace}}/api/DTO"`

**Where namespace appears in React:**
- `package.json` → `"name": "{{project_name}}-ui"`

> **All templates in this skill use `ns` as a placeholder.** When scaffolding, **replace `ns` with the actual UI namespace** in all generated files.

---

## Option A: SAP UI5 / Fiori Freestyle

### Directory Structure

```
app/
├── webapp/
│   ├── Component.js              # UI5 Component (entry point)
│   ├── manifest.json             # App descriptor (routes, models, i18n)
│   ├── index.html                # Bootstrap HTML
│   ├── controller/               # ★ Controllers (thin) + handler/ subfolders
│   │   ├── BaseController.js     # ★ Base controller all others extend
│   │   └── {Domain}/
│   │       ├── {Domain}List.controller.js
│   │       ├── {Domain}Detail.controller.js
│   │       └── handler/          # ★ Separated handler classes
│   │           └── {Domain}Handler.js
│   ├── view/                     # XML views
│   ├── fragments/                # Reusable XML fragments
│   ├── api/                      # ★ API layer
│   │   ├── API.js                # Main API client
│   │   ├── ENTITY.js             # ★ Entity name registry
│   │   ├── CUSTOM_PATH.js        # Custom REST endpoint paths
│   │   ├── DTO/                  # ★ Data Transfer Objects
│   │   │   └── {Entity}DTO.js
│   │   └── Entity/               # Entity-specific API modules
│   ├── interfaces/               # ★ Data shape definitions
│   │   ├── DTOInterface.js       # DTO factory base
│   │   ├── UserBaseInterface.js  # User profile shape
│   │   └── {Domain}Interface.js
│   ├── utils/                    # ★ Utility modules
│   │   ├── HttpRequest.js        # Generic HTTP request helper
│   │   ├── UICommon.js           # Common UI utilities
│   │   ├── UIValidation.js       # Form validation utilities
│   │   └── Enum/                 # ★ Enumerations (28+ enum files)
│   │       └── AppRouteEnum.js
│   ├── constants/                # Application constants
│   ├── components/               # Reusable UI5 components
│   ├── dto/                      # Additional DTOs
│   ├── model/                    # JSON models and formatters
│   ├── i18n/                     # Localization files
│   ├── css/                      # Custom stylesheets
│   ├── localService/             # Mock OData for local development
│   └── test/                     # Unit and integration tests
├── ui5.yaml                      # UI5 tooling config
└── package.json                  # Frontend dependencies
```

### Key Patterns

#### 1. BaseController (MUST extend)
> **Template**: `templates/ui5/webapp/controller/BaseController.js`

All controllers extend `BaseController` which provides:
- `getRouter()`, `getModel()`, `setModel()`
- `getResourceBundle()`, `getText()` — i18n access
- `showBusy()` / `hideBusy()` — loading indicators
- `navTo()` — simplified navigation

#### 2. Handler Delegation Pattern (CRITICAL)
> **Template**: `templates/ui5/webapp/controller/handler/MyHandler.js` (Create if needed)

**DO NOT** put all business logic in controllers. You MUST split logic into specialized handlers based on function:

**Required Structure**:
```
{Domain}/
├── {Domain}List.controller.js  → Thin controller, instantiates handlers
└── handler/
    ├── {Domain}FilterHandler.js  → Search, Filter logic, OData filter construction
    ├── {Domain}TableHandler.js   → Table events, formatting, value help, export
    ├── {Domain}ActionHandler.js  → Buttons, dialogs, status updates, navigation
```

**Implementation Steps**:
1. **Instantiate in `onInit`**:
   ```javascript
   onInit: function() {
       this.filterHandler = new MyFilterHandler(this);
       this.tableHandler = new MyTableHandler(this);
       this.actionHandler = new MyActionHandler(this);
   }
   ```
2. **Delegate Events**:
   ```javascript
   onSearch: function() {
       this.filterHandler.onSearch();
   }
   ```
3. **Pass `this` (Controller)**:
   Handlers verify `this.oController` exists to access Views, Models, and Router.

#### 3. Enum Pattern
> **Template**: `templates/ui5/webapp/utils/enum/AppRouteEnum.js`

- Place in `utils/enum/` folder
- Use `Object.freeze()` for immutability
- Use SCREAMING_SNAKE_CASE for keys

#### 4. Interface Pattern
> **Template**: `templates/ui5/webapp/interfaces/AppGlobalDataInterface.js`

- Use `Implementation()` factory function
- Returns spread of base fields + optional overrides

#### 5. Common Utilities
> **Templates**:
> - `templates/ui5/webapp/utils/UICommon.js`
> - `templates/ui5/webapp/utils/Authorization.js`
> - `templates/ui5/webapp/api/API.js`

- **UICommon**: General UI helpers (date formatting, logging, device detection).
- **Authorization**: User role and scope management.
- **API**: Centralized API wrapper.

#### 6. Core Configuration
> **Templates**:
> - `templates/ui5/webapp/manifest.json`
> - `templates/ui5/webapp/Component.js`
> - `templates/ui5/webapp/index.html`

- **manifest.json**: Standardized routing, flexible column layout config, and data sources.
- **Component.js**: Initializes `ShellUIService`, global models, and routing.

---

## Option B: React (react-v2 Template)

> ✅ **This is the standard React template.** Scaffolded by `templates/react-v2/`.

#### Directory Structure (react-v2)

```
app/<ui_folder>/
├── src/
│   ├── components/                   # ★ Shared UI components
│   │   ├── common/                  # StatusBadge, PriorityBadge, shared business UI
│   │   │   ├── StatusBadge.tsx
│   │   │   └── index.ts             # Barrel export
│   │   └── layouts/                 # App shell / sidebar layout
│   │       └── MainLayout.tsx       # Branded responsive sidebar
│   ├── config/                       # ★ App configuration constants
│   ├── contexts/                     # ★ React contexts
│   │   └── FioriThemeContext.tsx     # FLP theme/language context
│   ├── hooks/                        # ★ Shared hooks (app-wide)
│   │   ├── useConfirm.tsx           # Imperative confirm dialog hook
│   │   ├── useDateFormatter.ts      # Date formatting hook
│   │   ├── useFLPSync.ts            # ★ FLP URL sync hook (BTP Workzone)
│   │   ├── useNumberFormatter.ts    # Number formatting hook
│   │   ├── useODataQuery.ts         # Generic OData query hook
│   │   ├── usePagination.ts         # Pagination state hook
│   │   └── useUserInfo.ts           # User info from BTP
│   ├── pages/                        # ★ Route-level page components
│   │   └── <PageName>/              # Feature folder (see Feature Folder Structure)
│   │       ├── <PageName>.tsx       # Main page component
│   │       ├── components/          # Page-specific sub-components
│   │       ├── hooks/               # Page-specific hooks
│   │       └── index.ts             # Re-export
│   ├── services/                     # ★ Data access layer
│   │   ├── core/                    # BaseODataService, ODataQueryBuilder, ODataFilter
│   │   ├── domain/                  # Domain-specific service singletons
│   │   │   └── <domain>/           # e.g., extraction/, worklist/
│   │   ├── types/                   # Shared API types / interfaces
│   │   ├── api.ts                   # Axios instance config
│   │   └── index.ts                 # Barrel export
│   ├── styles/                       # ★ CSS
│   │   └── index.css                # @import '@cnma/react-ui/styles.css' + overrides
│   ├── utils/                        # ★ Pure utility functions
│   ├── locales/                      # ★ i18n translation files (en.json, de.json, etc.)
│   ├── i18n.ts                       # i18n configuration
│   ├── queryClient.ts                # TanStack Query client setup
│   ├── App.tsx                       # Root component (HashRouter + providers)
│   ├── main.tsx                      # Entry point (ReactDOM.createRoot)
│   └── vite-env.d.ts
├── public/                           # ★ BTP Workzone integration (CRITICAL)
│   ├── Component.js                 # UI5 UIComponent wrapper (loads React in iframe)
│   ├── manifest.json                # SAP app descriptor (Workzone tile, crossNavigation)
│   ├── index.html                   # HTML loaded inside the iframe
│   ├── xs-app.json                  # AppRouter config (routes, auth, X-Frame-Options)
│   └── i18n/                        # FLP-level i18n properties
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── package.json
└── .gitignore
```

#### File Naming Conventions (react-v2)

| File Type | Convention | Example |
|:----------|:-----------|:--------|
| Components | PascalCase `.tsx` | `StatusBadge.tsx`, `MainLayout.tsx` |
| Hooks | camelCase with `use` prefix `.ts`/`.tsx` | `useODataQuery.ts`, `useFLPSync.ts` |
| Services | camelCase `.ts` | `itemsService.ts`, `api.ts` |
| Types | camelCase with `.types.ts` suffix | `worklist.types.ts` |
| Config/Utils | camelCase `.ts` | `queryClient.ts`, `i18n.ts` |
| Barrel exports | `index.ts` in each folder | `components/common/index.ts` |
| CSS | camelCase `.css` | `index.css` |
| Translation files | language code `.json` | `en.json`, `de.json` |

#### Data Flow (react-v2)

```
Component → useODataQuery hook → Domain Service (extends BaseODataService) → Axios → OData API
```

**Layer rules:**
- `services/core/` — Infrastructure (BaseODataService, ODataQueryBuilder). Do NOT modify unless making core changes.
- `services/domain/` — Domain-specific service singletons. Always check here before creating a new service.
- `hooks/` — App-wide hooks. Page-specific hooks go inside `pages/<PageName>/hooks/`.
- `components/common/` — Shared business components (StatusBadge, etc.). Library components come from `@cnma/react-ui`.
- `pages/` — Feature folders following the Feature Folder Structure (see frontend-react-development skill).


---

## MTA Integration (Both Options)

### Safe Merge Rule (CRITICAL)
When `mta.yaml` already exists, **ONLY ADD or UPDATE** — **NEVER delete** existing modules, resources, or config.
- Read the current `mta.yaml` first
- Check if each module/resource already exists by `name`
- If exists → update its properties (merge, don't replace the entire block)
- If missing → append to the `modules:` or `resources:` array
- Never remove modules/resources that belong to other parts of the project (backend, DB, etc.)

### Checklist
1. Add `{{project_name}}_ui` module (type `html5`)
2. Add `{{project_name}}_ui_deployer` module (type `com.sap.application.content`)
3. Add `{{project_name}}_destination_content` module (type `com.sap.application.content`)
4. Add resource `{{project_name}}_xsuaa` (xsuaa, application plan) — if missing
5. Add resource `{{project_name}}_html5_host` (html5-apps-repo, app-host plan) — if missing
6. Add resource `{{project_name}}_destination` (destination, lite plan, `HTML5Runtime_enabled: true`) — if missing
7. If a CAP `srv` module exists, add it to destination `init_data` as `srv-api`. If backend is external, use placeholder URL.

### (1) UI Module
```yaml
  - name: {{project_name}}_ui
    type: html5
    path: app/{{app_folder_name}}
    build-parameters:
      build-result: dist
      builder: custom
      commands:
        - npm install
        - npm run build:cf      # MUST use build:cf (build + zip)
      supported-platforms: []
```

### (2) UI Deployer Module
```yaml
  - name: {{project_name}}_ui_deployer
    type: com.sap.application.content
    path: .
    requires:
      - name: {{project_name}}_html5_host
        parameters:
          content-target: true
    build-parameters:
      build-result: resources
      requires:
        - artifacts:
            - {{project_name}}.zip   # Matches zip name in package.json
          name: {{project_name}}_ui
          target-path: resources/
```

### (3) Destination Content Module
Registers service-key destinations so Managed AppRouter can resolve HTML5 apps and XSUAA tokens.
```yaml
  - name: {{project_name}}_destination_content
    type: com.sap.application.content
    requires:
      - name: {{project_name}}_xsuaa
        parameters:
          service-key:
            name: {{project_name}}_xsuaa_key
      - name: {{project_name}}_html5_host
        parameters:
          service-key:
            name: {{project_name}}_html5_host_key
      - name: {{project_name}}_destination
        parameters:
          content-target: true
    build-parameters:
      no-source: true
    parameters:
      content:
        instance:
          existing_destinations_policy: update
          destinations:
            - Name: {{project_name}}_html5_dest
              ServiceInstanceName: {{project_name}}_html5_host
              ServiceKeyName: {{project_name}}_html5_host_key
              sap.cloud.service: {{sap_cloud_service}}
            - Name: {{project_name}}_xsuaa_dest
              Authentication: OAuth2UserTokenExchange
              ServiceInstanceName: {{project_name}}_xsuaa
              ServiceKeyName: {{project_name}}_xsuaa_key
              sap.cloud.service: {{sap_cloud_service}}
```

### (4) Resources

#### XSUAA (add if missing)
```yaml
  - name: {{project_name}}_xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      config:
        tenant-mode: dedicated
        xsappname: {{project_name}}-${space}
      path: ./xs-security.json
      service: xsuaa
      service-plan: application
```

#### HTML5 App Repository Host (add if missing)
```yaml
  - name: {{project_name}}_html5_host
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-host
```

#### Destination Service (add if missing)
`HTML5Runtime_enabled: true` is required for Managed AppRouter to serve HTML5 apps.
The `init_data` section pre-creates a backend destination. Use the CAP `srv-api` URL if a `srv` module exists, or a placeholder for external backends.
```yaml
  - name: {{project_name}}_destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite
      config:
        HTML5Runtime_enabled: true
        init_data:
          instance:
            existing_destinations_policy: ignore
            destinations:
              # If CAP srv module exists:
              - Name: {{destination_name}}
                Description: Backend API
                Authentication: NoAuthentication
                ProxyType: Internet
                Type: HTTP
                URL: ~{srv-api/srv-url}       # Bound from srv module provides
                HTML5.DynamicDestination: true
                HTML5.ForwardAuthToken: true
              # If backend is external (no srv module in MTA):
              # - Name: {{destination_name}}
              #   Description: External Backend API
              #   Authentication: NoAuthentication
              #   ProxyType: Internet
              #   Type: HTTP
              #   URL: https://placeholder-update-after-deploy.example.com
              #   HTML5.DynamicDestination: true
              #   HTML5.ForwardAuthToken: true
```

### (5) Frontend package.json Scripts
Ensure the UI app's `package.json` includes `zip` and `build:cf` scripts.
The zip path is **relative from `dist/` to the MTA `resources/` folder** — adjust `../../resources` based on folder depth.
```json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "zip": "cd dist && npx -y mkdirp ../../resources && npx -y bestzip ../../resources/{{project_name}}.zip *",
    "build:cf": "npm run build && npm run zip"
  }
}
```

### Placeholder Reference

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{project_name}}` | MTA-safe project name (underscores) | `cdk_btp_app_manage` |
| `{{app_folder_name}}` | UI app folder name under `app/` | `btp-app-manage-ui` |
| `{{sap_cloud_service}}` | From `manifest.json` → `sap.cloud.service` | `cdk.btpappmanage` |
| `{{destination_name}}` | Destination name used in `xs-app.json` routes | `srv-api` |

## Scaffolding Scripts

| Script | Purpose |
|--------|---------|
| `scripts/scaffold_ui5.py` | Creates the full UI5 directory structure |
| `scripts/scaffold_react.py` | Creates the Clean Architecture directory structure |

## Execution Steps

1. **Ask user**: React or UI5?
2. **Run scaffold script**: Execute the appropriate Python script to create directories.
3. **Copy templates**: Populate core files from `templates/ui5/` or `templates/react/`.
4. **(React only) Copy branding templates**: Copy `templates/react/lib/utils.ts`, `templates/react/presentation/layout/MainLayout.tsx`, and `templates/react/presentation/styles/globals.css`. Replace `{{APP_TITLE}}` placeholder in MainLayout with the project's display name.
5. **(React only) Copy BTP Workzone templates**: Copy the full `templates/react/public/` folder (Component.js, manifest.json, index.html, xs-app.json). Replace namespace placeholders — see Section 9 for details.
6. **(React only) Copy FLP integration files**: Copy `templates/react/presentation/hooks/useFLPSync.ts` and `templates/react/presentation/contexts/FioriThemeContext.tsx`. Wire `useFLPSyncDirect()` and `FioriThemeProvider` in App.tsx — see Section 9.3.
7. **(React only) Install branding deps**: `npm install lucide-react clsx tailwind-merge`
8. **Create config**: `manifest.json` / `ui5.yaml` (UI5) or `tsconfig.json` / `package.json` (React).
9. **Update `mta.yaml`**: Add UI module and deployer.
## Variant Management Support

To add Variant Management (saving filter configurations) to a React Clean Architecture project, Copy and paste the following implementations.

### 1. Domain Entity (`src/domain/entities/Variant.ts`)
```typescript
export interface Variant {
    ID?: string;
    variantKey: string;
    variantName: string;
    workListId: string;
    isDefaultVariant: boolean;
    isGlobalVariant: boolean;
    filterBarVariant: string;
    filterDataVariant: string; // JSON-serialized filter state
    createdBy?: string;
}

export interface VariantFilterData {
    ddwnObjectType: string[];
    inpObjectKey: string;
    inpObjectProcessing: { start: string; end: string };
    ddwnEventStatus: string;
    ddwnEventType: string;
}
```

### 2. Repository Interface (`src/domain/repositories/IVariantRepository.ts`)
```typescript
import { Result } from '../../core/Result';
import type { Variant } from '../entities/Variant';

export interface IVariantRepository {
    getVariants(worklistId: string): Promise<Result<Variant[]>>;
    createVariant(variant: Variant): Promise<Result<Variant>>;
    updateVariant(variant: Variant): Promise<Result<void>>;
    deleteVariant(id: string): Promise<Result<void>>;
    setDefaultVariant(id: string, clearAllDefault: boolean): Promise<Result<void>>;
}
```

### 3. Data Source (`src/data/datasources/VariantDataSource.ts`)
*Note: Includes mapper for handling UpperCase (Backend) <-> camelCase (Frontend)*
```typescript
import { Result } from '../../core/Result';
import { HttpClient } from './HttpClient';
import { AppConfig } from '../../core/AppConfig';
import type { Variant } from '../../domain/entities/Variant';

// Response shape from OData GET
interface VariantListResponse {
    value: Variant[];
}

// Mapper: Backend (UPPERCASE) -> Frontend (camelCase)
const toFrontendVariant = (data: any): Variant => ({
    ID: data.ID,
    variantKey: data.VARIANTKEY,
    variantName: data.VARIANTNAME,
    workListId: data.WORKLISTID,
    isDefaultVariant: !!data.ISDEFAULTVARIANT,
    isGlobalVariant: !!data.ISGLOBALVARIANT,
    filterBarVariant: data.FILTERBARVARIANT,
    filterDataVariant: data.FILTERDATAVARIANT,
    createdBy: data.CREATEDBY
});

// Mapper: Frontend (camelCase) -> Backend (UPPERCASE)
const toBackendVariant = (variant: Variant): any => ({
    ID: variant.ID,
    VARIANTKEY: variant.variantKey,
    VARIANTNAME: variant.variantName,
    WORKLISTID: variant.workListId,
    ISDEFAULTVARIANT: variant.isDefaultVariant,
    ISGLOBALVARIANT: variant.isGlobalVariant,
    FILTERBARVARIANT: variant.filterBarVariant,
    FILTERDATAVARIANT: variant.filterDataVariant
});

export class VariantDataSource {
    private httpClient: HttpClient;

    constructor(httpClient: HttpClient) {
        this.httpClient = httpClient;
    }

    async getVariants(worklistId: string): Promise<Result<VariantListResponse>> {
        const response = await this.httpClient.get<VariantListResponse>(
            `${AppConfig.API_BASE_URL}/VariantSettings?$filter=workListId eq '${worklistId}'`
        );
        if (response.isSuccess && response.getValue().value) {
           const mappedValue = response.getValue().value.map(toFrontendVariant);
           return Result.ok({ value: mappedValue });
        }
        return response;
    }

    async createVariant(variant: Variant): Promise<Result<Variant>> {
        const payload = toBackendVariant(variant);
        const response = await this.httpClient.post<any>(`${AppConfig.API_BASE_URL}/VariantSettings`, payload);
        if (response.isSuccess) {
            return Result.ok(toFrontendVariant(response.getValue()));
        }
        return Result.fail(response.error as string);
    }

    async updateVariant(variant: Variant): Promise<Result<void>> {
        const payload = toBackendVariant(variant);
        return this.httpClient.put<void>(`${AppConfig.API_BASE_URL}/VariantSettings(${variant.ID})`, payload);
    }

    async deleteVariant(id: string): Promise<Result<void>> {
        return this.httpClient.delete<void>(`${AppConfig.API_BASE_URL}/VariantSettings(${id})`);
    }

    async setDefaultVariant(id: string, clearAllDefault: boolean): Promise<Result<void>> {
        return this.httpClient.post<void>(`${AppConfig.API_BASE_URL}/adjustDefaultVariantSetting`, {
            clearAllDefault,
            uuid: id,
        });
    }
}
```

### 4. Repository Implementation (`src/data/repositories/VariantRepository.ts`)
```typescript
import { Result } from '../../core/Result';
import type { Variant } from '../../domain/entities/Variant';
import type { IVariantRepository } from '../../domain/repositories/IVariantRepository';
import { VariantDataSource } from '../datasources/VariantDataSource';

export class VariantRepository implements IVariantRepository {
    private dataSource: VariantDataSource;

    constructor(dataSource: VariantDataSource) {
        this.dataSource = dataSource;
    }

    async getVariants(worklistId: string): Promise<Result<Variant[]>> {
        const result = await this.dataSource.getVariants(worklistId);
        if (result.isFailure) return Result.fail(result.error!);
        const response = result.getValue();
        return Result.ok(response.value || []);
    }

    async createVariant(variant: Variant): Promise<Result<Variant>> {
        return this.dataSource.createVariant(variant);
    }

    async updateVariant(variant: Variant): Promise<Result<void>> {
        return this.dataSource.updateVariant(variant);
    }

    async deleteVariant(id: string): Promise<Result<void>> {
        return this.dataSource.deleteVariant(id);
    }

    async setDefaultVariant(id: string, clearAllDefault: boolean): Promise<Result<void>> {
        return this.dataSource.setDefaultVariant(id, clearAllDefault);
    }
}
```

### 5. UI Component (`src/components/common/variant/VariantManagement.tsx`)
*Uses `@cnma/react-ui` components: Button, Input, Popover, Dialog, Checkbox, and Lucide React icons.*

This component provides a robust UI for managing variants, including saving, setting defaults, and deleting/renaming views.

---

## 8. CDK Brand Design System (React Projects)

Every react-v2 project MUST use the `@cnma/react-ui` library as the single source of truth for design tokens, components, and styling. This section documents how the design system integrates with the react-v2 template.

### 8.1 Design Tokens

All design tokens (colors, fonts, spacing) are bundled inside `@cnma/react-ui/styles.css`. You do NOT define tokens manually — they are imported automatically.

**Key tokens available via the library:**

| Category | Tokens | Usage |
|:---------|:-------|:------|
| Brand | `--color-brand`, `--color-brand-hover` | Primary CTA, sidebar accents |
| Semantic | `--palette-positive`, `--palette-negative`, `--palette-critical`, `--palette-informative` | Status badges, feedback |
| Layout | `--background`, `--card`, `--border`, `--muted` | Page bg, cards, dividers |
| Text | `--foreground`, `--muted-foreground` | Primary and secondary text |
| Font | SAP 72 family (`72`, `72full`, `Inter`, `Segoe UI`) | Enterprise typography |

> For the full token reference, see **[Design System Reference](../../skills/frontend-react-development/resources/Design.md)**.

### 8.2 CSS Setup (react-v2)

**`src/styles/index.css`** — single import from the library pulls everything:
```css
/* Pulls Tailwind base + SAP 72 font + all design tokens */
@import '@cnma/react-ui/styles.css';

/* App-level overrides only: */
:root {
  /* --status-custom: var(--palette-positive); */
}
```

> ⚠️ **NEVER put `@tailwind base/components/utilities`** — that's Tailwind v3 syntax. In v4, those directives are inside `@cnma/react-ui/styles.css`.

**Advanced — Custom theme tokens:** If you need app-level tokens beyond the library, use `@theme`:
```css
@import "tailwindcss";

@theme {
    --color-brand: var(--brand-red);
    --color-accent: var(--accent-color);
}
```

### 8.3 Tailwind v4 Setup

> ⚠️ **`@cnma/react-ui` requires Tailwind v4.** Do NOT use Tailwind v3.

**Required packages:**
```bash
npm install tailwindcss@^4 @tailwindcss/vite@^4
# Remove these if present (not needed in v4):
npm uninstall autoprefixer postcss
```

No `tailwind.config.js` or `postcss.config` needed — Tailwind v4 is configured entirely in CSS.

**`@cnma/react-ui` local file reference** (when using a local copy):
```json
"@cnma/react-ui": "file:../../../cnma-react-ui"
```
> ⚠️ The library's `dist/` folder must exist. Run `npm run build` inside `cnma-react-ui/` if missing.

### 8.4 Button Variants

The `@cnma/react-ui` `Button` component includes semantic variants. **Always use variants** instead of raw className overrides.

| Variant | Appearance | Use For |
|:--------|:-----------|:--------|
| `default` | Brand red bg, white text | Primary actions (Add, Save, Submit) |
| `destructive` | Red bg, white text | Irreversible destructive (Delete) |
| `outline` | White bg, gray border | Secondary neutral (Cancel, Export) |
| `outline-success` | Green border/text | Safe actions (Start, Approve) |
| `outline-danger` | Red border/text | Cautious destructive (Stop) |
| `outline-warning` | Orange border/text | Warning actions (Pause, Disable) |
| `success` | Green bg, white text | Confirmed safe (Start app) |
| `ghost` | Transparent, text only | Inline/icon-only actions |
| `link` | Text with underline | Navigation-style |

```tsx
import { Button } from '@cnma/react-ui';

<Button>Save</Button>                          {/* default = brand primary */}
<Button variant="outline">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline-success">Start</Button>
```

> **Critical:** `--primary-foreground` and `--destructive-foreground` MUST be `oklch(1 0 0)` (white). Without this, button text renders black.

### 8.5 Shared Components

Library components are imported from `@cnma/react-ui`. App-specific shared components live in `src/components/common/`.

```typescript
// Library components
import { Button, Input, DataTable, FilterBar, Badge } from '@cnma/react-ui';

// App-specific shared components
import { StatusBadge, ConfirmDialog, FormDialog, LoadingSpinner } from '@/components/common';
```

#### StatusBadge
Colored badge for entity status display.

| Variant | Color | Example Use |
|:--------|:------|:------------|
| `success` | Green | STARTED, Active, Completed |
| `error` | Red | STOPPED, Failed, Error |
| `warning` | Orange | Pending, Degraded |
| `info` | Blue | Processing, Syncing |
| `default` | Gray | Unknown, N/A |

```tsx
<StatusBadge variant="success">STARTED</StatusBadge>
```

#### ConfirmDialog
Modal confirmation for destructive or important actions.

```tsx
<ConfirmDialog
    open={open}
    onOpenChange={setOpen}
    title="Delete Schedule"
    description="This action cannot be undone."
    onConfirm={handleDelete}
    confirmLabel="Delete"
    variant="destructive"
/>
```

#### FormDialog
Dialog wrapper for forms with submit/cancel buttons and loading state.

```tsx
<FormDialog
    open={open}
    onOpenChange={setOpen}
    title="Add Schedule"
    onSubmit={handleSubmit}
    submitLabel="Save"
    loading={isSaving}
>
    {/* form fields */}
</FormDialog>
```

#### LoadingSpinner
Spinner with optional label, supports fullScreen overlay mode.

```tsx
<LoadingSpinner size="md" showLabel label="Loading apps..." />
<LoadingSpinner fullScreen /> {/* overlay during page load */}
```

### 8.6 Shared Hooks

#### useConfirmDialog
Imperative hook — avoids open/config state boilerplate per page.

```tsx
const { confirmProps, confirm } = useConfirmDialog();

confirm(
    { title: 'Delete?', description: 'Cannot undo.', variant: 'destructive' },
    async () => { await deleteItem(id); }
);

return <ConfirmDialog {...confirmProps} />;
```

#### useToast
Toast message hook with auto-dismiss (default 4s). Use instead of `window.alert()`.

```tsx
const { message, showSuccess, showError, clear } = useToast();

showSuccess('Schedule saved!');
showError('Failed to delete.');
```

### 8.7 Filter & ComboboxFilter Patterns

The `ComboboxFilter` is used for all dropdown/combobox filters. Key props:

| Prop | Type | Purpose |
|:-----|:-----|:--------|
| `label` | string | Display label (shown on button) |
| `value` | string | Selected value |
| `options` | `{value, label}[]` | Dropdown items |
| `onSelect` | `(value) => void` | Selection callback |
| `disabled` | boolean | Prevents opening, grays out |
| `fullWidth` | boolean | Makes button fill container width |

**Rules:**
- Labels above inputs, never inside
- No standalone "Search" buttons — filters apply immediately on selection
- Cascading dropdowns: disable downstream until parent is selected
- Auto-select first option after loading cascade data

### 8.8 Page Layout Patterns

**Page header:** Wrap title + action buttons in a card with flex layout.

```tsx
<div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-6">
    <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
            {t('pages.myPage.title')}
        </h1>
        <div className="flex gap-2">
            <Button variant="outline-success">{t('common.action')}</Button>
        </div>
    </div>
</div>
```

**Filter bar:** Place ComboboxFilter group above data content, inside a card.

**Data section:** Use `DataTable` for tabular data. Wrap in same card pattern.

**No `window.alert()` or `window.confirm()`** — always use `ConfirmDialog` and `useToast`.

### 8.9 CAP Backend Local Dev Setup

To run the CAP backend locally with TypeScript and SQLite (no XSUAA binding required):

```bash
npm install sqlite3
npm install -D tsx
```

**`package.json` CDS config:**
```json
"cds": {
  "requires": {
    "db": {
      "kind": "hana",
      "[development]": { "kind": "sqlite", "credentials": { "url": ":memory:" } }
    },
    "auth": {
      "kind": "xsuaa",
      "[development]": {
        "kind": "mocked",
        "users": {
          "admin": { "password": "", "roles": ["Admin", "User"] }
        }
      }
    }
  }
}
```

**Start with:** `npx cds watch` (tsx auto-detected from `tsconfig.json`)

---

## 9. BTP Workzone Compatibility (React Projects — CRITICAL)

Every React Clean Architecture project deployed to SAP Build Workzone **MUST** include the `public/` folder and FLP integration hooks. Without these, the app won't appear as a tile in the Launchpad and deep linking / theme sync will not work.

### 9.1 public/ Folder — Workzone Shell Files

These files make the React app appear as a Fiori tile in Workzone. The `Component.js` creates an iframe that loads the React app, isolating HashRouter from the Launchpad shell.

| File | Purpose | Template |
|------|---------|----------|
| `Component.js` | UI5 UIComponent that wraps React in an iframe | `templates/react/public/Component.js` |
| `manifest.json` | SAP app descriptor (tile title, icon, crossNavigation) | `templates/react/public/manifest.json` |
| `index.html` | HTML loaded inside the iframe with `<div id="root">` | `templates/react/public/index.html` |
| `xs-app.json` | AppRouter routes (API proxy, auth, X-Frame-Options) | `templates/react/public/xs-app.json` |

#### Namespace Placeholders

| Placeholder | Format | Example | Used In |
|-------------|--------|---------|---------|
| `{{NAMESPACE_DOT}}` | Dot notation | `cdk.btpappmanage` | manifest.json `sap.app.id`, `sap.cloud.service`, Component.js extend |
| `{{NAMESPACE_SLASH}}` | Slash notation | `cdk/btpappmanage` | Component.js `sap.ui.require.toUrl()` |
| `{{APP_TITLE}}` | Display name | `BTP App Manager` | manifest.json title, index.html `<title>` |
| `{{APP_DESCRIPTION}}` | Short description | `Monitor and manage...` | manifest.json description |
| `{{INBOUND_ID}}` | Snake_case ID | `btpappmanage_inbound` | manifest.json crossNavigation key |
| `{{SEMANTIC_OBJECT}}` | Launchpad object | `btpapp` | manifest.json crossNavigation |
| `{{SEMANTIC_ACTION}}` | Launchpad action | `manage` | manifest.json crossNavigation |
| `{{APP_SUBTITLE}}` | Tile subtitle | `Schedule Monitor` | manifest.json crossNavigation |
| `{{APP_ICON}}` | SAP icon | `sap-icon://settings` | manifest.json icons |
| `{{DESTINATION_NAME}}` | MTA destination | `srv-api` | xs-app.json routes |
| `{{AUTH_TYPE}}` | Auth type | `none` or `xsuaa` | xs-app.json routes |

### 9.2 FLP Integration Hooks

#### `useFLPSync.ts` — URL Sync with Launchpad
> **Template**: `templates/react/presentation/hooks/useFLPSync.ts`

Exports:
- `useFLPSyncDirect()` — Hook that syncs React Router location with parent FLP URL via `replaceState`. Enables deep linking (copy/paste URL works).
- `getInitialFLPRoute()` — Reads initial route from parent hash for deep link navigation on app load.
- `isEmbeddedInFLP()` / `isInIframe()` — Detection helpers.
- `getInitialFLPParams()` — Reads `sap-locale`, `sap-language`, `sap-theme` from parent URL.
- `normalizeSapLocale()` — Converts SAP locale format (e.g., `en_US` → `en-us`).

#### `FioriThemeContext.tsx` — Theme & Language from FLP
> **Template**: `templates/react/presentation/contexts/FioriThemeContext.tsx`

Provides `FioriThemeProvider` and `useFioriTheme()` hook. On mount:
1. Reads FLP params (`sap-theme`, `sap-locale`, `sap-language`)
2. Applies SAP theme via `data-sap-theme` attribute and `sapUiTheme-*` body class
3. Sets language state (connect to i18n if available)

### 9.3 App.tsx Wiring Pattern (MUST follow)

```tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@ui5/webcomponents-react';
import { FioriThemeProvider } from './presentation/contexts/FioriThemeContext';
import { useFLPSyncDirect } from './presentation/hooks/useFLPSync';
import { MainLayout } from './presentation/layout/MainLayout';

/** Inner component that uses hooks requiring Router context */
function AppContent() {
    useFLPSyncDirect(); // Sync URL with parent FLP when embedded in Workzone

    return (
        <FioriThemeProvider>
            <MainLayout>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    {/* Add routes here */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </MainLayout>
        </FioriThemeProvider>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <HashRouter>
                <AppContent />
            </HashRouter>
        </ThemeProvider>
    );
}
```

**Key points:**
- `useFLPSyncDirect()` must be inside `<HashRouter>` (needs `useLocation`)
- `FioriThemeProvider` wraps `MainLayout` so all children can access `useFioriTheme()`
- `ThemeProvider` (UI5) wraps everything for webcomponent theming

---

## 🤖 Agent Verification Protocol (MANDATORY)

**Protocol**: After performing any `scaffold`, `refactor`, or `move` operations, the Agent **MUST** automatically run the verification scripts below to validate the integrity of the codebase.

### React Projects
```bash
node .agent/skills/cnma-cap-frontend/scripts/verify-react-imports.js
```

### UI5 Projects
```bash
node .agent/skills/cnma-cap-frontend/scripts/verify-ui5-imports.js
```

**Validation Rule**:
- If any script returns an error, the Agent **MUST STOP**, analyze the error, and fix the broken imports content/paths before reporting success to the User.
