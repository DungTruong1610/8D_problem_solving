# ObjectStore + Pre-Signed URLs - Quick Reference

> **TL;DR**: Use pre-signed URLs to enable direct file uploads/downloads from client to S3, bypassing the backend server for better performance and scalability.

---

## 🎯 Core Concept

```
❌ Old Way: Client → Backend → S3 (backend becomes bottleneck)
✅ New Way: Client ← Backend (URL only)
           Client → S3 (direct upload/download)
```

**Key Benefit**: Backend only generates URLs; files never touch backend = **infinite scalability**

---

## 📦 Required Packages

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## 🔧 Setup Checklist

### 1. Environment Configuration

**Local (MinIO)**:
```bash
export S3_ENDPOINT=http://localhost:9000
export S3_BUCKET=attachments
export S3_ACCESS_KEY_ID=minioadmin
export S3_SECRET_ACCESS_KEY=minioadmin
```

**BTP Production** (automatic via VCAP_SERVICES):
```yaml
# mta.yaml
resources:
  - name: my-app-objectstore
    type: org.cloudfoundry.managed-service
    parameters:
      service: objectstore
      service-plan: s3-standard
```

### 2. ObjectStore Provider

Create `srv/lib/object-store.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class ObjectStoreProvider {
    private static client: S3Client;
    private static bucket: string;

    static initialize() {
        // Read from VCAP_SERVICES or env vars
        // Create S3Client
        // Store bucket name
    }

    static async getUploadUrl(contentId: string, mimeType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: contentId,
            ContentType: mimeType
        });
        return getSignedUrl(this.client, command, { expiresIn: 3600 });
    }

    static async getDownloadUrl(contentId: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: contentId
        });
        return getSignedUrl(this.client, command, { expiresIn: 3600 });
    }
}
```

### 3. Service Actions

In your CDS service definition:

```cds
entity Attachments : cuid, managed {
    fileName   : String;
    mimeType   : String;
    size       : Integer;
    contentId  : String;  // S3 object key
    request    : Association to Requests;
}

service RequestService {
    entity Attachments as projection on db.Attachments
        actions {
            action getUploadUrl(fileName: String, mimeType: String) 
                returns { contentId: String; url: String; };
            action getDownloadUrl() returns String;
        };
}
```

### 4. Handler Implementation

```typescript
// srv/handlers/AttachmentHandler.ts
export class AttachmentHandler {
    register() {
        this.srv.on('getUploadUrl', 'Attachments', async (req) => {
            const { fileName, mimeType } = req.data;
            const contentId = `${cds.utils.uuid()}/${fileName}`;
            const url = await ObjectStoreProvider.getUploadUrl(contentId, mimeType);
            return { contentId, url };
        });

        this.srv.on('getDownloadUrl', 'Attachments', async (req) => {
            const attachment = await SELECT.one.from(Attachments, req.params[0].ID);
            const url = await ObjectStoreProvider.getDownloadUrl(attachment.contentId);
            return url;
        });
    }
}
```

---

## 💻 Frontend Implementation

### Upload Flow

```typescript
async function uploadFile(file: File, requestId: string) {
    // 1. Get upload URL from backend
    const { contentId, url } = await fetch('/browse/Attachments/getUploadUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type })
    }).then(r => r.json());

    // 2. Upload directly to S3
    await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
    });

    // 3. Save metadata to database
    await fetch('/browse/Attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            contentId: contentId,
            request_ID: requestId
        })
    });
}
```

### Download Flow

```typescript
async function downloadFile(attachmentId: string, fileName: string) {
    // 1. Get download URL from backend
    const url = await fetch(`/browse/Attachments(${attachmentId})/getDownloadUrl`, {
        method: 'POST'
    }).then(r => r.text());

    // 2. Download from S3
    const blob = await fetch(url).then(r => r.blob());

    // 3. Trigger download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}
```

---

## 🔐 Security Features

| Feature | Description |
|---------|-------------|
| **Time-Limited** | URLs expire after 1 hour (configurable) |
| **Single-Use Intent** | URLs are specific to one file and one operation |
| **No Credential Exposure** | S3 keys never leave backend |
| **Backend Authorization** | User permissions checked before URL generation |
| **Audit Trail** | All URL requests logged |

---

## 🚀 Local Development with MinIO

```bash
# Start MinIO
docker run -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"

# Open MinIO Console: http://localhost:9001
# Login: minioadmin / minioadmin
# Create bucket: "attachments"

# Set environment variables
export S3_ENDPOINT=http://localhost:9000
export S3_BUCKET=attachments
```

---

## 📊 Comparison

| Aspect | Traditional Upload | Pre-Signed URL |
|--------|-------------------|----------------|
| **File route** | Client → Backend → S3 | Client → S3 (direct) |
| **Backend load** | High (processes files) | Low (generates URLs) |
| **Scalability** | Limited by backend | Unlimited |
| **Network cost** | 2x (upload + forward) | 1x (direct upload) |
| **Speed** | Slower | Faster |
| **Backend complexity** | High | Low |

---

## 🎨 Architecture Pattern

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ 1. getUploadUrl(fileName, mimeType)
       ▼
┌─────────────┐      2. Generate        ┌──────────────┐
│   Backend   │───────signed URL───────▶│ S3 / Object  │
└──────┬──────┘                         │    Store     │
       │                                └──────────────┘
       │ 3. Return {contentId, url}            ▲
       ▼                                       │
┌─────────────┐                               │
│   Frontend  │───────4. PUT file─────────────┘
└──────┬──────┘        (direct to S3)
       │
       │ 5. Save metadata (fileName, size, contentId)
       ▼
┌─────────────┐
│   Backend   │
└─────────────┘
```

---

## ✅ Best Practices

1. **Always generate unique contentId**: Use `UUID/filename` format
2. **Set appropriate expiration**: Default 3600s (1 hour)
3. **Validate on backend**: Check user permissions before generating URL
4. **Log all operations**: Track URL generation for audit
5. **Handle errors gracefully**: Pre-signed URL generation can fail
6. **Clean up on delete**: Delete S3 object when metadata deleted
7. **Use CORS in production**: Configure S3 bucket CORS for your domain

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| 403 Forbidden on upload | Check S3 credentials and bucket permissions |
| URL expires too quickly | Increase `expiresIn` parameter |
| CORS error | Configure S3 CORS policy |
| File not found on download | Verify contentId stored correctly |
| MinIO connection refused | Ensure MinIO running and S3_ENDPOINT set |

---

## 📚 References

- [Full Technical Guide](./object-store-signed-url-guide.md)
- [AWS S3 Pre-Signed URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [SAP BTP Object Store](https://help.sap.com/docs/object-store)
- [MinIO Documentation](https://min.io/docs/)

---

**Quick Start**: Copy ObjectStore Provider → Add to MTA → Create Actions → Use in Frontend
