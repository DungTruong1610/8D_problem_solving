# Example: Storage Strategy Pattern (Open/Closed in practice)

Problem: the app needs to upload user images. Today it's Google Drive. Tomorrow
it might be local disk, S3, or Cloudinary. Classic OCP scenario — we want to
**add** providers without **modifying** any service code.

---

## The interface (contract)

```ts
// interfaces/storage.interfaces.ts
import type { Readable } from 'stream';

export interface IStorageProvider {
  /** Upload a file. Returns a provider-specific file ID. */
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>;

  /** Delete by provider file ID. No-op if already gone. */
  delete(fileId: string): Promise<void>;

  /** Get a readable stream for download/proxy. */
  getStream(fileId: string): Promise<{ stream: Readable; mimeType: string }>;

  /** Cheap check so the factory can pick a default. */
  isConfigured(): boolean;
}
```

Services, controllers, and middleware only ever see `IStorageProvider`. They
don't know — and can't — which backend is serving them.

---

## Implementations

```ts
// services/storage/googleDrive.storage.ts
export class GoogleDriveStorage implements IStorageProvider {
  async upload(buffer, filename, mimeType) { /* ... Drive SDK call ... */ }
  async delete(fileId)                     { /* ... */ }
  async getStream(fileId)                  { /* ... */ }
  isConfigured()                           { return !!CLIENT_ID && !!CLIENT_SECRET; }
}

// services/storage/local.storage.ts
export class LocalStorage implements IStorageProvider {
  async upload(buffer, filename, mimeType) { /* ... fs.writeFile ... */ }
  async delete(fileId)                     { /* ... */ }
  async getStream(fileId)                  { /* ... */ }
  isConfigured()                           { return true; }
}
```

Each class is self-contained. No shared state. No conditionals on "which
backend". If Google Drive credentials change, `googleDrive.storage.ts` is the
one file that changes.

---

## The factory

```ts
// services/storage/storage.factory.ts
import { GoogleDriveStorage } from './googleDrive.storage.js';
import { LocalStorage }       from './local.storage.js';
import type { IStorageProvider } from '../../interfaces/storage.interfaces.js';

export function createStorageProvider(): IStorageProvider {
  const drive = new GoogleDriveStorage();
  if (drive.isConfigured()) return drive;
  return new LocalStorage();
}
```

The factory picks a sensible default. That's its only job.

---

## Wiring

```ts
// composition/container.ts
import { createStorageProvider } from '../services/storage/storage.factory.js';

export const storageProvider = createStorageProvider();
// ... pass to any service that needs storage:
const tradeService = new TradeService(tradeRepo, tradeMapper, storageProvider);
```

`TradeService` takes `IStorageProvider` in its constructor. It doesn't import
any concrete class. It doesn't know — doesn't want to know — which provider is
active.

---

## Adding S3: the whole diff

**Step 1**: create `services/storage/s3.storage.ts`:

```ts
export class S3Storage implements IStorageProvider {
  async upload(buffer, filename, mimeType) { /* AWS SDK ... */ }
  async delete(fileId)                     { /* ... */ }
  async getStream(fileId)                  { /* ... */ }
  isConfigured()                           { return !!process.env.AWS_BUCKET; }
}
```

**Step 2**: update the factory (one line):

```ts
export function createStorageProvider(): IStorageProvider {
  const s3    = new S3Storage();
  const drive = new GoogleDriveStorage();
  if (s3.isConfigured())    return s3;
  if (drive.isConfigured()) return drive;
  return new LocalStorage();
}
```

**Step 3**: done.

- No controller changed.
- No service changed.
- No route changed.
- The tests that used `storageProvider` still pass.

That is Open/Closed in action: the system extended, nothing closed modified.

---

## What would a violation look like?

```ts
// ❌ Anti-pattern
async function uploadImage(file, provider: 'drive' | 'local' | 's3') {
  if (provider === 'drive') { /* Drive code */ }
  else if (provider === 'local') { /* fs code */ }
  else if (provider === 's3') { /* AWS code */ }
}
```

Every new provider means editing this function. Every edit risks breaking the
old branches. The function grows until it's untestable.

Replace with the Strategy pattern above. The `if` chain disappears; each
provider is an isolated class; adding one doesn't touch callers.
