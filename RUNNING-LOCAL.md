# Running Locally

> **Competition context:** [AI4Biz 2026 - LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Technical examples are not measured business outcomes.

This guide follows the checked-in package scripts and local configuration. Provider access and available models depend on your environment. Translating this guide does not constitute a fresh runtime verification.

## 1. Install dependencies

Run these commands from the repository root:

```powershell
npm install
npm install --prefix app/8D_hackathon_ui
Copy-Item .env.example .env
```

The current package manifest resolves the project's `@cnma` packages from tarballs in `packages/`. Keep those files available. Resolve any registry authentication required by other dependencies through your local npm configuration.

You can start without live AI credentials. See the provider modes below.

## 2. Initialize the local database

```powershell
npm run deploy:sqlite
```

The checked-in SQLite configuration uses `db.sqlite` in the project root. SQLite does not require a separate database server.

Initialize the database before opening pages that read model and configuration tables. Deployment creates or updates the schema and loads applicable seed data. Back up any local data you need before redeploying or replacing the database.

For the project's sample-data seeder, run:

```powershell
npm run seed:sqlite
```

## 3. Start the application

```powershell
npm run dev
```

This starts the backend and frontend together:

| Component | Address |
| - | - |
| CAP backend | http://localhost:4008 |
| Vite frontend | http://localhost:5544 |
| AI settings | http://localhost:5544/#/ai-settings |

To start them separately:

```powershell
npm run dev:backend
npm run dev --prefix app/8D_hackathon_ui
```

### Local authentication

The local configuration uses mocked authentication with the development account `admin` and password `123`. The Vite proxy supplies this development authentication header to backend requests.

When calling the backend directly, supply the same local credentials:

```powershell
curl.exe -u admin:123 http://localhost:4008/api/cnma/AI_SRV/AIModels
```

## 4. AI provider modes

### Mode A - No live provider configured

Without standalone chat settings or AI Core credentials, the application installs a mock chat provider. Startup messages identify `mock-chat` and indicate whether an embedding provider is available. The actual diagnostic messages may be localized.

AI settings remain accessible, but an empty model registry or a failed **Sync** does not establish a working live provider. This mode is useful for interface work that does not require real AI output.

### Mode B - Explicit mock mode

Set this in `.env`:

```env
MOCK_LLM=true
```

The mock provider returns synthetic responses without making model requests. Its completion response includes fields such as `mock`, `model` and `messageCount`. Its embedding methods return empty arrays, allowing the retrieval layer to distinguish missing vectors from valid embeddings.

Use this mode for local integration work. Mock output is not evidence of model quality or live provider availability. Check the active configuration before demonstrating or deploying the application.

### Mode C - Standalone chat and embedding providers

Chat and embedding providers are selected independently. The current chat selection order is DeepSeek, Gemini, a local OpenAI-compatible endpoint, then the AI Core fallback. Explicit mock mode takes precedence.

For a DeepSeek-compatible configuration, set `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL`. Use a model identifier supported by the selected endpoint. The repository includes examples for the official endpoint and an OpenCode-compatible endpoint; their availability depends on the provider account.

Configure embeddings separately with `JINA_API_KEY` or the `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` settings. The current factory also supports Gemini embeddings when configured. `EMBEDDINGS_DISABLED=true` disables the embedding provider.

Restart the backend after changing provider settings. Check the startup diagnostics for the selected chat provider, embedding provider, model and vector dimension.

To probe the configured provider explicitly:

```powershell
npx tsx scripts/probe-ai.ts
```

This probe can make live provider requests. It checks the configured provider's supported operations, including structured output and embedding behavior.

If no embedding backend is available, semantic matching cannot contribute a valid similarity score. The application may still run using other matching criteria; inspect the startup messages before interpreting results.

### Mode D - SAP AI Core

The legacy AI Core integration remains available when the standalone chat providers are not selected. Configure either a service key through `AICORE_SERVICE_KEY` or the separate settings:

- `AICORE_AUTH_URL`
- `AICORE_CLIENT_ID`
- `AICORE_CLIENT_SECRET`
- `AICORE_BASE_URL`
- `AICORE_RESOURCE_GROUP`

Use the values supplied by your AI Core service instance. The authentication variable is `AICORE_AUTH_URL`, not `AICORE_TOKEN_URL`.

Restart the backend and inspect the startup diagnostics. Open AI settings and use **Sync** to retrieve the model catalog when the configured integration supports it.

## 5. Sample data

CAP loads applicable CSV seed files from `db/data/` during database deployment. Filenames follow the namespace/entity convention, for example:

```text
db/data/cnma.proresolve-SampleEntity.csv
```

CAP does not automatically treat arbitrary JSON fixtures as seed files. Either convert the data to the expected CSV format or use a dedicated seeding script after initializing the database.

A simplified custom seeder has this structure:

```ts
// Example only: adapt the entity and input file to the actual model.
import cds from '@sap/cds';
import data from './mockdata.json';

(async () => {
  const db = await cds.connect.to('db');
  await db.run(cds.ql.INSERT.into('cnma.proresolve.SampleEntity').entries(data));
  console.log(`Loaded ${data.length} records`);
})();
```

A custom seeder is useful when the fixture contains nested data that does not map directly to CSV rows.

### Exporting local cases for a deployment

The repository's seed-snapshot workflow can copy local 8D reports, discipline state and review events into CSV seed files:

```powershell
npm run export:seed
```

This overwrites the `cnma.proresolve-Reports.csv`, `cnma.proresolve-Disciplines.csv` and `cnma.proresolve-ReviewEvents.csv` snapshots from the local `db.sqlite`. Review the generated data before committing it. A later deployment that loads these snapshots can reproduce the exported records.

The existing deployment workflow may recreate its database from seed files. Do not assume that records entered into a deployed instance persist across a rebuild; persistence depends on its storage configuration. Closed application cases can be synchronized into the precedent library during startup. Uploaded `TaskEvidences` are not included in the CSV snapshot because their content is binary.

## 6. Troubleshooting

| Symptom | Likely cause | What to check |
| - | - | - |
| AI settings fail to load | Database tables have not been initialized | Run `npm run deploy:sqlite` for the intended local database |
| Model list is empty after Sync | Missing settings, invalid credentials or an unavailable provider | Inspect startup and provider diagnostics |
| Model selector is empty | The frontend registry was not registered | Check that `src/config/ai-registry.ts` is called from `main.tsx` |
| Sync returns HTTP 403 on deployment | Missing CSRF handling | Use `services/ai-model-service.ts`, rather than bypassing it with the CDK API factory |
| Port 4008 or 5544 is occupied | Another process is listening | Stop the conflicting local process or update the backend and proxy together |
| npm reports a peer-dependency conflict | Package or npm configuration mismatch | Inspect `.npmrc` and the actual dependency error |

## 7. Configuration details that matter

**Register AI activities on both sides.** Backend registration lives in `srv/server.ts`; frontend registration lives in `app/8D_hackathon_ui/src/config/ai-registry.ts`. They run in separate processes. Adding an activity to only one side can leave a selector empty or prevent the backend from resolving its configuration.

**Changing an embedding model requires rebuilding stored embeddings.** Vectors from different models do not necessarily share a comparable space, even when their dimensions match. Update the model configuration and regenerate the affected vectors together before relying on similarity results.
