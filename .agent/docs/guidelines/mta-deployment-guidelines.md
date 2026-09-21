---
description: Guidelines for setting up MTA deployment with Standalone AppRouter and SAP Build Work Zone support
---

# MTA Deployment Setup Guidelines

This guide covers setting up Multi-Target Application (MTA) deployment for SAP CAP + React projects with support for **both** Standalone AppRouter access and SAP Build Work Zone integration.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HTML5 Repository                         │
│              (Stores built React/UI5 app)                   │
└─────────────────────────────────────────────────────────────┘
                    ▲                    ▲
        ┌───────────┴─────────┐  ┌───────┴───────────┐
        │  Standalone         │  │  Work Zone        │
        │  AppRouter          │  │  Managed Router   │
        └─────────────────────┘  └───────────────────┘
                    │                    │
       https://app-approuter...    Launchpad Tile
       (Direct URL access)         (Portal integration)
```

---

## Required Files

### 1. Root Level

| File | Purpose |
|------|---------|
| `mta.yaml` | MTA deployment descriptor |
| `xs-security.json` | XSUAA roles and scopes |

### 2. AppRouter Folder (`approuter/`)

| File | Purpose |
|------|---------|
| `package.json` | `@sap/approuter` dependency |
| `xs-app.json` | Routing rules |

### 3. Frontend App Folder (`app/`)

| File | Purpose |
|------|---------|
| `xs-app.json` | Routing for Work Zone managed router |
| `manifest.json` | Fiori app descriptor with tile config |

---

## Step-by-Step Setup

### Step 1: Create `mta.yaml`

Replace placeholders with your project-specific values:
- `<MTA_ID>`: e.g., `mta-my-project`
- `<MODULE_PREFIX>`: e.g., `mta-mp`
- `<SERVICE_NAME>`: e.g., `com.company.myproject`

```yaml
_schema-version: "3.1"
ID: <MTA_ID>
version: 1.0.0

parameters:
  enable-parallel-deployments: true

build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm ci
        - npm run build --prefix app
        - npx cds build --production

modules:
  # CAP Backend
  - name: <MODULE_PREFIX>-srv
    type: nodejs
    path: gen/srv
    parameters:
      buildpack: nodejs_buildpack
      memory: 256M
    requires:
      - name: <MODULE_PREFIX>-uaa
      - name: <MODULE_PREFIX>-db
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}

  # HANA DB Deployer
  - name: <MODULE_PREFIX>-db-deployer
    type: hdb
    path: gen/db
    requires:
      - name: <MODULE_PREFIX>-db

  # HTML5 Content Deployer
  - name: <MODULE_PREFIX>-app-deployer
    type: com.sap.application.content
    path: .
    requires:
      - name: <MODULE_PREFIX>-html5-repo-host
        parameters:
          content-target: true
    build-parameters:
      build-result: resources
      requires:
        - name: <MODULE_PREFIX>-app
          artifacts:
            - app.zip
          target-path: resources/

  # React App Build
  - name: <MODULE_PREFIX>-app
    type: html5
    path: app
    build-parameters:
      builder: custom
      commands:
        - npm ci
        - npm run build
      build-result: dist
      supported-platforms: []

  # Standalone AppRouter
  - name: <MODULE_PREFIX>-approuter
    type: approuter.nodejs
    path: approuter
    parameters:
      memory: 256M
    requires:
      - name: <MODULE_PREFIX>-uaa
      - name: <MODULE_PREFIX>-html5-repo-runtime
      - name: srv-api
        group: destinations
        properties:
          name: srv-api
          url: ~{srv-url}
          forwardAuthToken: true

  # Work Zone Destination Content
  - name: <MODULE_PREFIX>-destination-content
    type: com.sap.application.content
    requires:
      - name: <MODULE_PREFIX>-uaa
        parameters:
          service-key:
            name: <MODULE_PREFIX>-uaa-key
      - name: <MODULE_PREFIX>-html5-repo-host
        parameters:
          service-key:
            name: <MODULE_PREFIX>-html5-repo-host-key
      - name: <MODULE_PREFIX>-destination
        parameters:
          content-target: true
    build-parameters:
      no-source: true
    parameters:
      content:
        instance:
          existing_destinations_policy: update
          destinations:
            - Name: <MODULE_PREFIX>-html5-repo-host
              ServiceInstanceName: <MODULE_PREFIX>-html5-repo-host
              ServiceKeyName: <MODULE_PREFIX>-html5-repo-host-key
              sap.cloud.service: <SERVICE_NAME>
            - Name: <MODULE_PREFIX>-uaa
              Authentication: OAuth2UserTokenExchange
              ServiceInstanceName: <MODULE_PREFIX>-uaa
              ServiceKeyName: <MODULE_PREFIX>-uaa-key
              sap.cloud.service: <SERVICE_NAME>

resources:
  - name: <MODULE_PREFIX>-uaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
      config:
        xsappname: <MTA_ID>-${org}-${space}
        tenant-mode: dedicated

  - name: <MODULE_PREFIX>-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared

  - name: <MODULE_PREFIX>-html5-repo-host
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-host

  - name: <MODULE_PREFIX>-html5-repo-runtime
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-runtime

  - name: <MODULE_PREFIX>-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite
      config:
        init_data:
          instance:
            existing_destinations_policy: update
            destinations:
              - Name: <MODULE_PREFIX>-srv-api
                URL: ~{srv-api/srv-url}
                Authentication: NoAuthentication
                Type: HTTP
                ProxyType: Internet
                HTML5.ForwardAuthToken: true
                HTML5.DynamicDestination: true
    requires:
      - name: srv-api
```

---

### Step 2: Create AppRouter Files

**`approuter/package.json`**:
```json
{
  "name": "approuter",
  "version": "1.0.0",
  "dependencies": {
    "@sap/approuter": "^16"
  },
  "scripts": {
    "start": "node node_modules/@sap/approuter/approuter.js"
  }
}
```

**`approuter/xs-app.json`**:
```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/(.*)$",
      "target": "/odata/v4/$1",
      "destination": "srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": false
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

---

### Step 3: Create App Configuration

**`app/xs-app.json`**:
```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/(.*)$",
      "target": "/odata/v4/$1",
      "destination": "<MODULE_PREFIX>-srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": false
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "localDir": ".",
      "authenticationType": "xsuaa"
    }
  ]
}
```

**`app/manifest.json`**:
```json
{
  "_version": "1.21.0",
  "sap.app": {
    "id": "<SERVICE_NAME>",
    "type": "application",
    "title": "<APP_TITLE>",
    "description": "<APP_DESCRIPTION>",
    "applicationVersion": {
      "version": "1.0.0"
    },
    "crossNavigation": {
      "inbounds": {
        "<intent-id>": {
          "semanticObject": "<SemanticObject>",
          "action": "manage",
          "title": "<TILE_TITLE>",
          "subTitle": "<TILE_SUBTITLE>",
          "icon": "sap-icon://task",
          "signature": {
            "parameters": {},
            "additionalParameters": "allowed"
          }
        }
      }
    }
  },
  "sap.ui5": {
    "dependencies": {
      "minUI5Version": "1.120.0"
    }
  },
  "sap.cloud": {
    "public": true,
    "service": "<SERVICE_NAME>"
  }
}
```

---

## Build & Deploy

### Build MTA Archive
```bash
# Clean previous builds
npx rimraf gen *.mtar

# Install dependencies
npm ci
npm ci --prefix app

# Build React app
npm run build --prefix app

# Generate CDS artifacts
npx cds build --production

# Build MTA
mbt build -t . --mtar <MTA_ID>.mtar
```

### Deploy to Cloud Foundry
```bash
cf login -a <api-endpoint>
cf deploy <MTA_ID>.mtar
```

---

## Work Zone Integration

After deployment:

1. Go to **SAP BTP Cockpit** → **Instances and Subscriptions**
2. Open **SAP Build Work Zone** (Standard or Advanced)
3. Navigate to **Content Manager** → **Content Explorer**
4. Find your app by the `sap.cloud.service` value
5. Add to a **Group** and assign to a **Role**
6. Create/update **Site** to display the tile

---

## Checklist

- [ ] `mta.yaml` created with all modules
- [ ] `xs-security.json` has required scopes/roles
- [ ] `approuter/` folder with `package.json` and `xs-app.json`
- [ ] `app/xs-app.json` for routing
- [ ] `app/manifest.json` with `crossNavigation` for Work Zone
- [ ] MTA builds successfully
- [ ] Deployed to BTP Cloud Foundry
- [ ] App accessible via standalone URL
- [ ] Tile visible in Work Zone (if applicable)
