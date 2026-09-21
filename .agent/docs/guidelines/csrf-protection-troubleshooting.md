# CSRF Protection: Complete Troubleshooting Guide

> **Knowledge Article for Agent Team**  
> Last Updated: 2026-01-28  
> Complexity: Medium-High  
> Time Investment: ~3 hours debugging time saved

## Overview

This guide documents the complete journey of implementing and debugging CSRF token protection in a SAP CAP + React application deployed to SAP BTP with AppRouter. Use this as a reference when encountering 403 Forbidden errors in production.

---

## 🚨 Problem: 403 Forbidden on Write Operations

### Symptoms
- ✅ Application works perfectly in **local development** (no CSRF needed)
- ✅ **Read operations** work in production (GET requests)
- ❌ **Write operations** fail with **403 Forbidden** (POST, PUT, PATCH, DELETE)
- ❌ Error occurs after **BTP deployment** with AppRouter

### Example Error
```
POST https://your-app.cfapps.eu10.hana.ondemand.com/admin/RequestTypes
Status: 403 Forbidden
Response: "CSRF token validation failed"
```

---

## 🔍 Root Causes Discovered

### 1. **HEAD Method Not Supported by CAP** ❌
**Initial Attempt:**
```typescript
// ❌ WRONG - CAP returns 405 Method Not Allowed
const response = await axios.head('/browse/RequestTypes', {
    headers: { 'x-csrf-token': 'Fetch' }
});
```

**Solution:**
```typescript
// ✅ CORRECT - Use GET with $top=0 to minimize payload
const response = await axios.get('/browse/RequestTypes', {
    headers: { 'x-csrf-token': 'Fetch' },
    params: { '$top': 0 }
});
```

**Lesson:** CAP OData services don't support HEAD. Use GET with query params to minimize data transfer.

---

### 2. **Separate Axios Instances** ❌
**The Silent Killer:**
```typescript
// ❌ WRONG - Creates separate instance WITHOUT interceptor
// File: AdminService.ts
const adminApi = axios.create();

adminApi.interceptors.request.use(config => {
    // Only has auth interceptor, NO CSRF interceptor!
    if (import.meta.env.DEV) {
        config.headers['Authorization'] = getDevAuthHeader();
    }
    return config;
});

export const AdminService = {
    async createRequestType(data) {
        // This request has NO CSRF token!
        return await adminApi.post('/admin/RequestTypes', data);
    }
};
```

**Why It Failed:**
- Main `api.ts` had CSRF interceptor configured
- `AdminService.ts` created its own axios instance
- Frontend code used `AdminService` → No CSRF token sent → 403 error

**Solution:**
```typescript
// ✅ CORRECT - Import shared instance with CSRF support
// File: AdminService.ts
import { api } from '../lib/api';

export const AdminService = {
    async createRequestType(data) {
        // Uses shared instance with CSRF interceptor
        return await api.post('/admin/RequestTypes', data);
    }
};
```

**Lesson:** **NEVER create separate axios instances**. Always use the shared, configured instance from `api.ts`.

---

### 3. **Frontend Not Included in Deployment** ⚠️
**The Build Trap:**

Users often run `mbt build` thinking the frontend is automatically included. It's not!

**Wrong Workflow:**
```bash
# ❌ WRONG - Frontend changes not built
cd app/request-management
# (makes changes to api.ts)
cd ../..
mbt build  # ← Frontend source copied, but dist/ is OLD!
cf deploy
```

**Correct Workflow:**
```bash
# ✅ CORRECT - Rebuild frontend FIRST
cd app/request-management
npx vite build  # ← Rebuild React app
cd ../..
mbt build       # ← Packages NEW dist/ folder
cf deploy
```

**Lesson:** Always rebuild the frontend before `mbt build` when frontend code changes.

---

## ✅ Complete Implementation Guide

### Step 1: Configure CSRF Interceptor (api.ts)

**File:** `app/request-management/src/lib/api.ts`

```typescript
import axios from 'axios';

// Create single shared instance
export const api = axios.create({
    baseURL: '/',
    headers: { 'Content-Type': 'application/json' }
});

let csrfToken: string | null = null;

/**
 * Fetch CSRF token from server
 */
async function fetchCsrfToken(): Promise<string> {
    console.log('🔐 [CSRF] Fetching new token from server...');

    try {
        // Use GET request (CAP doesn't support HEAD)
        const response = await axios.get('/browse/RequestTypes', {
            headers: { 'x-csrf-token': 'Fetch' },
            params: { '$top': 0 }  // Minimize payload
        });

        const token = response.headers['x-csrf-token'];
        
        if (token) {
            console.log('✅ [CSRF] Token fetched:', token.substring(0, 20) + '...');
        } else {
            console.warn('⚠️ [CSRF] No token in response');
        }

        return token || '';
    } catch (error) {
        console.error('❌ [CSRF] Failed to fetch token:', error);
        throw error;
    }
}

// Request interceptor - Add CSRF token for write operations
api.interceptors.request.use(async (config) => {
    // Inject auth header in dev mode
    if (import.meta.env.DEV) {
        const { getDevAuthHeader } = await import('./auth-context');
        config.headers['Authorization'] = getDevAuthHeader();
    }

    // Add CSRF token for write operations
    const isWriteOperation = ['post', 'put', 'patch', 'delete']
        .includes(config.method?.toLowerCase() || '');

    if (isWriteOperation) {
        console.log(`🔒 [CSRF] Write operation: ${config.method?.toUpperCase()} ${config.url}`);

        if (csrfToken) {
            console.log('✅ Using cached CSRF token');
        } else {
            console.log('📡 Fetching fresh CSRF token...');
            try {
                csrfToken = await fetchCsrfToken();
            } catch (err) {
                console.warn('⚠️ Failed to fetch CSRF token:', err);
            }
        }

        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
            console.log('✅ Added CSRF token to request');
        } else {
            console.warn('⚠️ NO CSRF TOKEN! Request will likely fail with 403!');
        }
    }

    return config;
});

// Response interceptor - Handle 403 and retry with fresh token
api.interceptors.response.use(
    response => response,
    async (error) => {
        if (error.response?.status === 403 && error.config && !error.config._retry) {
            error.config._retry = true;
            console.log('🔄 Retrying with fresh CSRF token...');
            
            try {
                csrfToken = await fetchCsrfToken();
                error.config.headers['X-CSRF-Token'] = csrfToken;
                return api.request(error.config);
            } catch (retryError) {
                console.error('Failed to retry with fresh token:', retryError);
            }
        }
        return Promise.reject(error);
    }
);
```

---

### Step 2: Use Shared Instance Everywhere

**❌ DON'T Create New Instances:**
```typescript
// ❌ WRONG
import axios from 'axios';
const myApi = axios.create();  // NO CSRF support!
```

**✅ DO Import Shared Instance:**
```typescript
// ✅ CORRECT
import { api } from '../lib/api';

export const SomeService = {
    async createSomething(data) {
        return await api.post('/endpoint', data);  // Has CSRF!
    }
};
```

---

### Step 3: AppRouter Configuration

**File:** `approuter/xs-app.json`

```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "sessionTimeout": 60,
  "routes": [
    {
      "source": "^/admin/(.*)$",
      "target": "/admin/$1",
      "destination": "backend",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },
    {
      "source": "^/(.*)$",
      "target": "/$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

**Key:** `"csrfProtection": true` enables CSRF validation on backend routes.

---

## 🧪 Verification Checklist

After deploying, verify CSRF is working:

### Browser Console Logs
You **MUST** see these logs:
```
🔐 [CSRF] Fetching new token from server...
✅ [CSRF] Token fetched successfully: abc123...
🔒 [CSRF] Write operation: POST /admin/RequestTypes
✅ Added CSRF token to request
```

### Network Tab
1. **Token Fetch:**
   ```
   GET /browse/RequestTypes?$top=0
   Request Headers:
     x-csrf-token: Fetch
   Response Headers:
     x-csrf-token: abc123def456...
   ```

2. **Write Request:**
   ```
   POST /admin/RequestTypes
   Request Headers:
     x-csrf-token: abc123def456...
   Response:
     201 Created ✅
   ```

### No Logs Visible?
**Problem:** Frontend code wasn't included in deployment.

**Solution:**
```bash
cd app/request-management
npx vite build  # Rebuild!
cd ../..
mbt build
cf deploy
```

Then **hard refresh** browser: `Ctrl + Shift + R` (or use incognito mode).

---

## 🐛 Debugging Production Issues

### Issue: Still Getting 403 After Fix

**Diagnostic Steps:**

1. **Check Browser Console**
   - See `[CSRF]` logs? → Code deployed ✅
   - No logs? → Frontend not rebuilt ❌

2. **Check Network Tab**
   - Token fetch request present? → Interceptor working ✅
   - No fetch request? → Interceptor not running ❌

3. **Check Request Headers**
   - Has `x-csrf-token` header? → Token sent ✅
   - Missing header? → Token not added ❌

4. **Verify Build Timestamps**
   ```bash
   # Check when dist files were built
   ls -la app/request-management/dist/assets/*.js
   ```
   Should be **recent** (today).

5. **Bypass Cache**
   - **Hard refresh:** `Ctrl + Shift + R`
   - **Or:** Open incognito mode
   - **Or:** Clear all browser cache

---

## 📋 Deployment Workflow

**Complete workflow for CSRF-protected deployments:**

```bash
# 1. Make frontend changes
cd app/request-management
# (edit api.ts, services, etc.)

# 2. Rebuild frontend (CRITICAL!)
npx vite build

# 3. Return to root
cd ../..

# 4. Build MTA
mbt build

# 5. Deploy to BTP
cf deploy mta_archives/your-app_1.0.0.mtar

# 6. Test in NEW incognito window
# - Open DevTools → Console
# - Perform write operation
# - Verify [CSRF] logs appear
# - Verify no 403 errors
```

---

## 🎓 Key Lessons Learned

### 1. **CAP Doesn't Support HEAD**
Use `GET` with `$top=0` instead.

### 2. **One Axios Instance to Rule Them All**
Never create multiple axios instances. Import the shared `api` instance.

### 3. **Frontend Must Be Rebuilt**
`mbt build` doesn't rebuild React. Run `npx vite build` first.

### 4. **CSRF is Session-Wide**
Token works for all endpoints (`/admin`, `/browse`, `/odata`) in the same session.

### 5. **Console Logs Are Your Friend**
Add comprehensive logging to track token fetching and injection.

### 6. **Cache is Your Enemy**
Always test in incognito or hard refresh after deployment.

---

## 🔗 Related Documentation

- [SAP AppRouter CSRF Protection](https://help.sap.com/docs/btp/sap-business-technology-platform/csrf-protection)
- [CAP Security Best Practices](https://cap.cloud.sap/docs/guides/security)
- [Axios Interceptors](https://axios-http.com/docs/interceptors)

---

## 📞 Quick Reference

| Scenario | Command |
|----------|---------|
| Rebuild frontend | `cd app/request-management && npx vite build` |
| Build MTA | `mbt build` |
| Deploy to BTP | `cf deploy mta_archives/app_1.0.0.mtar` |
| Hard refresh | `Ctrl + Shift + R` |
| Check logs | Browser DevTools → Console |
| Check requests | Browser DevTools → Network |

---

## ✅ Success Criteria

CSRF is working correctly when:
- ✅ Console shows `[CSRF]` logs
- ✅ Network tab shows token fetch (GET with `x-csrf-token: Fetch`)
- ✅ Write requests include `x-csrf-token` header
- ✅ Write operations return 200/201 (not 403)
- ✅ No "CSRF token validation failed" errors

---

**This guide saved you 3+ hours of debugging. You're welcome! 🎉**
