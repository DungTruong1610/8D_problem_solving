# ObjectStore with Pre-Signed URLs - Implementation Package

**Version**: 1.0  
**Last Updated**: 2026-01-20  
**Source Project**: Flexible Request Management  

---

## 📦 Package Contents

This package contains everything needed to implement the ObjectStore pattern with pre-signed URLs in your SAP CAP project.

### Documentation Files
- **`07-object-store-signed-url-guide.md`** - Complete technical guide (20 min read)
- **`08-object-store-quick-reference.md`** - Quick reference card (5 min read)
- **`07-objectstore-architecture-diagram.png`** - Visual architecture diagram
- **`09-malware-scanning-integration.md`** - Integration guide for SAP Malware Scanning Service (15 min read)

### Source Code Files
- **`object-store.ts`** - Production-ready ObjectStore provider implementation
- **`AttachmentHandler.ts`** - CAP service handler with example actions
- **`package-dependencies.md`** - Required NPM packages

---

## 🚀 Quick Start Guide

### 1. Read the Documentation (15-30 minutes)

**Recommended reading order:**

1. **Quick Reference** (`08-object-store-quick-reference.md`) - 5 min
   - Get a quick overview of the pattern
   - Understand the basic flow
   - See minimal code examples

2. **Architecture Diagram** (`07-objectstore-architecture-diagram.png`) - 2 min
   - Visualize the upload and download flows
   - Understand how components interact

3. **Complete Guide** (`07-object-store-signed-url-guide.md`) - 20 min
   - Deep dive into concepts
   - Security benefits
   - Configuration options
   - Deployment strategies

### 2. Review the Source Code (30-60 minutes)

**Study these files in order:**

1. **`object-store.ts`** - Core implementation
   - Pay attention to VCAP_SERVICES parsing
   - Note the initialization pattern
   - Review error handling

2. **`AttachmentHandler.ts`** - CAP integration
   - See how to register actions
   - Understand the two-phase upload pattern
   - Learn cleanup on delete pattern

### 3. Set Up Your Environment

**For Local Development:**

```bash
# Start MinIO (S3-compatible storage)
docker run -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"

# Open MinIO Console: http://localhost:9001
# Login: minioadmin / minioadmin
# Create bucket: "attachments"
```

**Environment Variables:**
```bash
export S3_ENDPOINT=http://localhost:9000
export S3_BUCKET=attachments
export S3_ACCESS_KEY_ID=minioadmin
export S3_SECRET_ACCESS_KEY=minioadmin
```

### 4. Install Dependencies

See `package-dependencies.md` for required NPM packages.

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 5. Implement in Your Project

**Step-by-step:**

1. ✅ Copy `object-store.ts` to `srv/lib/`
2. ✅ Copy `AttachmentHandler.ts` to `srv/handlers/`
3. ✅ Add dependencies to `package.json`
4. ✅ Initialize ObjectStore in `srv/server.ts`
5. ✅ Define Attachments entity in your CDS model
6. ✅ Register handler in your service
7. ✅ Test upload flow
8. ✅ Test download flow

### 6. Deploy to SAP BTP

Add ObjectStore service to `mta.yaml`:

```yaml
resources:
  - name: your-app-objectstore
    type: org.cloudfoundry.managed-service
    parameters:
      service: objectstore
      service-plan: s3-standard
```

Bind to your service module:

```yaml
modules:
  - name: your-app-srv
    requires:
      - name: your-app-objectstore
```

---

## 🎯 Implementation Checklist

### Planning Phase
- [ ] Read Quick Reference (5 min)
- [ ] Review Architecture Diagram (2 min)
- [ ] Read Complete Technical Guide (20 min)
- [ ] Review source code files (30 min)
- [ ] Understand the two-phase upload pattern

### Local Development Setup
- [ ] Install Docker (if not already installed)
- [ ] Start MinIO container
- [ ] Create bucket in MinIO console
- [ ] Set environment variables

### Code Integration
- [ ] Install required NPM packages
- [ ] Copy `object-store.ts` to `srv/lib/`
- [ ] Copy `AttachmentHandler.ts` to `srv/handlers/`
- [ ] Create/Update Attachments entity in CDS model
- [ ] Initialize ObjectStore in server startup
- [ ] Register AttachmentHandler in service

### Testing
- [ ] Test getUploadUrl action
- [ ] Test direct upload to S3/MinIO
- [ ] Test metadata save to database
- [ ] Test getDownloadUrl action
- [ ] Test direct download from S3/MinIO
- [ ] Test delete cleanup

### BTP Deployment
- [ ] Add ObjectStore service to `mta.yaml`
- [ ] Bind service to CAP module
- [ ] Deploy to BTP
- [ ] Test in BTP environment
- [ ] Verify VCAP_SERVICES parsing
- [ ] Verify production upload/download

---

## 🏗️ Project Structure

After implementation, your project should look like:

```
your-project/
├── srv/
│   ├── lib/
│   │   └── object-store.ts          ← Copy from this package
│   ├── handlers/
│   │   └── AttachmentHandler.ts     ← Copy from this package
│   └── server.ts                     ← Initialize ObjectStore here
├── db/
│   └── schema.cds                    ← Define Attachments entity
├── mta.yaml                          ← Add ObjectStore service
└── package.json                      ← Add dependencies
```

---

## 📋 Entity Definition Example

Add this to your `db/schema.cds`:

```cds
entity Attachments : cuid, managed {
    fileName   : String;
    mimeType   : String;
    size       : Integer;
    contentId  : String;  // S3 object key (UUID/filename)
    
    // Association to your parent entity
    request    : Association to Requests;
}
```

Add actions to your service definition (`srv/service.cds`):

```cds
service RequestService {
    entity Attachments as projection on db.Attachments
        actions {
            action getUploadUrl(fileName: String, mimeType: String) 
                returns { contentId: String; url: String; };
            
            action getDownloadUrl() returns String;
        };
}
```

---

## 🔑 Key Concepts Recap

### Pre-Signed URL
A temporary, secure URL that grants time-limited access to perform a specific operation (PUT/GET) on a specific file without requiring authentication credentials.

### Two-Phase Upload Pattern
1. **Phase 1**: Frontend gets upload URL from backend
2. **Phase 2**: Frontend uploads file directly to S3, then saves metadata

### Content ID Format
`{UUID}/{originalFileName}`

Example: `a3f2c1d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f/invoice.pdf`

### Benefits
- ✅ Files never pass through backend
- ✅ Infinite scalability
- ✅ Lower network costs
- ✅ Faster uploads/downloads
- ✅ Backend only generates URLs

---

## 🔐 Security Highlights

| Security Feature | Description |
|-----------------|-------------|
| **Time-Limited** | URLs expire after 1 hour (configurable) |
| **Single Operation** | URL works only for specified operation (PUT or GET) |
| **Specific File** | URL tied to exact file path |
| **No Credential Exposure** | S3 keys never leave backend |
| **Backend Authorization** | User permissions checked before URL generation |
| **Audit Trail** | All URL requests logged |

---

## 🐛 Troubleshooting

### Common Issues

**1. "ObjectStoreProvider not initialized"**
- Ensure `ObjectStoreProvider.initialize()` called in `server.ts`
- Check environment variables or VCAP_SERVICES

**2. "403 Forbidden" on upload**
- Verify S3 credentials are correct
- Check bucket permissions
- Ensure bucket exists

**3. CORS errors in browser**
- Configure CORS policy on S3 bucket
- For MinIO, set CORS via console or API

**4. File not found on download**
- Verify `contentId` stored correctly in database
- Check if file actually uploaded to S3
- Ensure bucket name is correct

**5. MinIO connection refused**
- Ensure MinIO container is running
- Check `S3_ENDPOINT` points to correct URL
- Verify port 9000 is accessible

---

## 📊 Performance Comparison

| Metric | Traditional Upload | Pre-Signed URL |
|--------|-------------------|----------------|
| **Backend CPU** | High (file processing) | Minimal (URL generation) |
| **Backend Memory** | High (file buffering) | Minimal |
| **Network** | 2x (client→backend→S3) | 1x (client→S3) |
| **Scalability** | Limited by backend | Unlimited |
| **Speed (10MB file)** | ~8-12 seconds | ~3-5 seconds |
| **Concurrent uploads** | ~50-100 | Unlimited |

---

## 🎓 Learning Resources

### Included in This Package
- Complete Technical Guide (comprehensive)
- Quick Reference Card (rapid lookup)
- Production Source Code (proven implementation)

### External Resources
- [AWS S3 Pre-Signed URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [SAP BTP Object Store](https://help.sap.com/docs/object-store)
- [MinIO Documentation](https://min.io/docs/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

---

## 💡 Best Practices

1. **Always generate unique contentId** using UUID
2. **Set appropriate expiration** (default: 3600 seconds)
3. **Validate user permissions** before generating URL
4. **Log all operations** for audit trail
5. **Handle errors gracefully** throughout the flow
6. **Clean up S3 objects** when metadata deleted
7. **Use CORS in production** for your domain
8. **Test both local and BTP** environments
9. **Monitor S3 costs** in production
10. **Document your implementation** for your team

---

## 🤝 Support & Questions

If you have questions about this implementation:

1. **Start with**: Quick Reference Card
2. **Read**: Complete Technical Guide
3. **Review**: Source code comments
4. **Check**: Troubleshooting section above
5. **Contact**: Original implementation team

---

## 📅 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-20 | Initial package release |

---

## 📜 License

This implementation package is shared for internal use and knowledge transfer within SAP BTP projects.

---

**Ready to implement?** Start with the Quick Reference Card and work your way through the checklist! 🚀
