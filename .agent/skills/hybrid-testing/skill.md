---
description: Configure and run hybrid testing with BTP services locally
---

# Hybrid Testing Skill

Expert knowledge for setting up and running SAP CAP applications locally with live BTP service connections.

## Core Concepts

### Configuration Files

| File | Purpose | Git Status |
|------|---------|------------|
| `.cdsrc-private.json` | Service binding references (org/space/instance/key) | ✅ Safe to commit |
| `default-env.json` | Static VCAP_SERVICES with actual credentials | ❌ Never commit |
| `.cdsrc.json` | Public CDS configuration (body limits, etc.) | ✅ Commit |

### Preference Order

**Always prefer `.cdsrc-private.json`** because:
- No secrets stored - only CF references
- Credentials fetched live from CF
- Automatic credential rotation
- Team members only need CF login

---

## Setting Up Hybrid Bindings

### Prerequisites

```bash
# 1. Login to Cloud Foundry
cf login --sso

# 2. Target correct org/space
cf target -o "Your-Org" -s "Your-Space"
```

### Binding Services

Use `cds bind` to add services to `.cdsrc-private.json`:

```bash
# Syntax: cds bind -2 <service-instance>:<service-key>

# Database
cds bind -2 my-app-db:my-app-db-key

# Destination
cds bind -2 my-app-destination:destination-key

# Object Store
cds bind -2 my-app-objectstore:objectstore-key

# Malware Scanner
cds bind -2 my-app-malware-scanner:malware-key

# AI Core
cds bind -2 my-app-aicore:aicore-key
```

### Creating Service Keys (if needed)

```bash
# Create service key first
cf create-service-key my-app-objectstore objectstore-key

# Then bind
cds bind -2 my-app-objectstore:objectstore-key
```

---

## Running Hybrid Mode

### Start Server

```bash
# Uses [hybrid] profile from package.json
cds watch --profile hybrid

# Or via npm script
npm run start:hybrid
```

### Expected Output

```
resolving cloud service bindings...
bound db to cf managed service my-app-db:my-app-db-key
bound objectstore to cf managed service my-app-objectstore:objectstore-key
bound malware-scanner to cf managed service my-app-malware-scanner:malware-key
```

---

## Package.json Configuration

```json
{
  "cds": {
    "requires": {
      "[hybrid]": {
        "db": {
          "kind": "hana",
          "pool": { "max": 20 }
        },
        "auth": {
          "kind": "mocked",
          "users": {
            "admin": { "roles": ["admin"] }
          }
        }
      }
    }
  }
}
```

---

## Common Services

### Object Store (S3)

```bash
# Create instance
cf create-service objectstore standard my-app-objectstore

# Create key
cf create-service-key my-app-objectstore objectstore-key

# Bind
cds bind -2 my-app-objectstore:objectstore-key
```

**Code Access:**
```typescript
const vcap = JSON.parse(process.env.VCAP_SERVICES);
const { bucket, access_key_id, secret_access_key, region } = 
  vcap['objectstore'][0].credentials;
```

### Malware Scanner (ClamAV)

```bash
cf create-service malware-scanner clamav my-app-malware-scanner
cf create-service-key my-app-malware-scanner malware-key
cds bind -2 my-app-malware-scanner:malware-key
```

**Code Access:**
```typescript
const vcap = JSON.parse(process.env.VCAP_SERVICES);
const { url, username, password } = 
  vcap['malware-scanner'][0].credentials;
```

### AI Core

```bash
cf create-service aicore extended my-app-aicore
cf create-service-key my-app-aicore aicore-key
cds bind -2 my-app-aicore:aicore-key
```

---

## Troubleshooting

### Service Not Binding

```bash
# Verify service exists
cf services

# Verify service key exists
cf service-keys my-app-objectstore

# Check binding
cds env get requires --profile hybrid
```

### Stale Credentials

```bash
# Re-fetch from CF
cds bind -2 my-app-objectstore:objectstore-key --force
```

### Clear All Bindings

```bash
# Delete .cdsrc-private.json and rebind
rm .cdsrc-private.json
cds bind -2 my-app-db:my-app-db-key
# ... repeat for other services
```

---

## Best Practices

1. **Always use `.cdsrc-private.json`** for hybrid testing
2. **Add `default-env.json` to `.gitignore`**
3. **Document required services** in project README
4. **Use consistent naming**: `<app>-<service>` for instances, `<service>-key` for keys
5. **Rotate keys periodically** via CF (bindings auto-refresh)
