# Required NPM Dependencies

## Package Installation

To implement the ObjectStore pattern with pre-signed URLs, you need to install the following NPM packages:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## Dependencies Detail

### Production Dependencies

Add these to the `dependencies` section of your `package.json`:

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.962.0",
    "@aws-sdk/s3-request-presigner": "^3.962.0"
  }
}
```

### Dependency Descriptions

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | ^3.962.0 | AWS SDK v3 S3 client - provides S3 operations (PUT, GET, DELETE) |
| `@aws-sdk/s3-request-presigner` | ^3.962.0 | Generates pre-signed URLs for S3 operations |

---

## Version Compatibility

### AWS SDK v3
- ✅ **Recommended**: Use AWS SDK v3 (modern, modular, tree-shakeable)
- ❌ **Avoid**: AWS SDK v2 (legacy, larger bundle size)

### Why v3?
- **Modular**: Import only what you need
- **Smaller**: Reduced bundle size
- **Modern**: TypeScript-first, async/await
- **Performance**: Better performance and less memory usage

---

## Installation Steps

### 1. Install Dependencies

```bash
cd your-project
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Verify Installation

```bash
npm list @aws-sdk/client-s3
npm list @aws-sdk/s3-request-presigner
```

Expected output:
```
your-project@1.0.0
├── @aws-sdk/client-s3@3.962.0
└── @aws-sdk/s3-request-presigner@3.962.0
```

### 3. Update package.json

Your `package.json` should include:

```json
{
  "name": "your-project",
  "version": "1.0.0",
  "dependencies": {
    "@sap/cds": "^9",
    "@aws-sdk/client-s3": "^3.962.0",
    "@aws-sdk/s3-request-presigner": "^3.962.0"
  }
}
```

---

## Import Examples

### In object-store.ts

```typescript
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
```

### What Each Import Does

| Import | Purpose |
|--------|---------|
| `S3Client` | Main S3 client class for connecting to S3/ObjectStore |
| `PutObjectCommand` | Command for uploading files to S3 |
| `GetObjectCommand` | Command for downloading files from S3 |
| `DeleteObjectCommand` | Command for deleting files from S3 |
| `getSignedUrl` | Function to generate pre-signed URLs from commands |

---

## Development Dependencies (Optional)

For local testing with TypeScript:

```json
{
  "devDependencies": {
    "@types/node": "^25.0.0",
    "typescript": "^5"
  }
}
```

---

## Alternative: All Dependencies

If you're starting a new SAP CAP project, here's a complete `package.json` example:

```json
{
  "name": "your-cap-project",
  "version": "1.0.0",
  "description": "SAP CAP project with ObjectStore support",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.962.0",
    "@aws-sdk/s3-request-presigner": "^3.962.0",
    "@sap/cds": "^9",
    "@cap-js/hana": "^2",
    "@sap/xssec": "^4"
  },
  "devDependencies": {
    "@cap-js/cds-types": "^0.15.0",
    "@cap-js/sqlite": "^2",
    "@sap/cds-dk": "^9",
    "@types/node": "^25.0.0",
    "typescript": "^5"
  },
  "scripts": {
    "start": "cds-serve",
    "dev": "cds watch"
  }
}
```

---

## Package Size

| Package | Unpacked Size | Note |
|---------|--------------|------|
| `@aws-sdk/client-s3` | ~1.5 MB | Core S3 functionality |
| `@aws-sdk/s3-request-presigner` | ~150 KB | Pre-signed URL generation |
| **Total** | **~1.65 MB** | Minimal overhead |

---

## Environment-Specific Notes

### Local Development
No special dependencies needed for MinIO - it's S3-compatible and works with the same AWS SDK packages.

### SAP BTP Production
The same packages work for SAP BTP Object Store service, as it's also S3-compatible.

---

## Troubleshooting

### Issue: "Cannot find module '@aws-sdk/client-s3'"

**Solution**:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Issue: Version conflicts

**Solution**: Use exact versions or update all AWS SDK packages together:
```bash
npm install @aws-sdk/client-s3@latest @aws-sdk/s3-request-presigner@latest
```

### Issue: Large bundle size in frontend

**Solution**: These packages should ONLY be used in backend (Node.js). Never import AWS SDK in frontend code.

---

## Security Notes

- ✅ **Backend only**: These packages should only be installed and used in your backend service
- ✅ **Credentials**: Never expose AWS credentials to frontend
- ✅ **Pre-signed URLs**: Frontend uses pre-signed URLs, not AWS SDK directly

---

## Additional Resources

- [AWS SDK for JavaScript v3 Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [NPM: @aws-sdk/client-s3](https://www.npmjs.com/package/@aws-sdk/client-s3)
- [NPM: @aws-sdk/s3-request-presigner](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner)

---

**Next Step**: After installing dependencies, proceed to copy the source code files (`object-store.ts` and `AttachmentHandler.ts`) to your project.
