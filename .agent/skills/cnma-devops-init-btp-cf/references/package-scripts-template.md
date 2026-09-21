# package.json Scripts Template

Variables: `{{APP_UNDERSCORE}}` `{{APP_HYPHEN}}` `{{MTAR}}`

**MERGE rule:** Only add keys that are missing. Never overwrite `name`, `version`, `description`, `dependencies`, `devDependencies`.

---

## Scripts block to merge

```json
"scripts": {
    "start": "cds-serve",
    "dev": "cds watch",
    "watch": "cds watch",
    "idev": "npm i --include=dev",
    "clean": "rimraf gen mta_archives ui_resources .{{APP_UNDERSCORE}}_mta_build_tmp @cds-models",
    "build": "cds build --production",
    "build:ts": "echo 'Compiling TypeScript...' && tsc",
    "build:db": "cds build --production",
    "build:srv": "mbt module-build -m={{APP_UNDERSCORE}}_srv -t mta_archives",
    "build:cf": "npm run clean && npm run build:ts && npm run build && mbt build --mtar {{MTAR}}",
    "deploy": "cf deploy mta_archives/{{MTAR}} --retries 1",
    "deploy:cf": "npm run build:cf && npm run deploy",
    "deploy:payg": "npm run clean && mbt build && cf deploy mta_archives/{{MTAR}} --retries 1 -e .deploycfg/payg.mtaext",
    "deploy:cpea": "npm run clean && mbt build && cf deploy mta_archives/{{MTAR}} --retries 1 -e .deploycfg/cpea.mtaext",
    "deploy:db": "npm run build:db && cds deploy --to hana",
    "deploy:srv": "npm run build:srv && cf deploy mta_archives/{{MTAR}} -m={{APP_UNDERSCORE}}_srv",
    "deploy:app": "npm run clean && mbt module-build -m={{APP_UNDERSCORE}}_ui_deployer -a -g && cf deploy -m {{APP_UNDERSCORE}}_ui_deployer",
    "cf:payg": "cf login -a https://api.cf.eu10.hana.ondemand.com",
    "cf:cpea": "cf login -a https://api.cf.eu10-004.hana.ondemand.com",
    "psize": "ls -lh mta_archives/{{MTAR}}"
}
```

> For `srv-only` projects: omit `deploy:app` (no UI deployer).

---

## eslintConfig block to merge

```json
"eslintConfig": {
    "extends": "eslint:recommended",
    "env": {
        "es2020": true,
        "node": true
    },
    "globals": {
        "SELECT": true,
        "INSERT": true,
        "UPDATE": true,
        "DELETE": true,
        "CREATE": true,
        "DROP": true,
        "CDL": true,
        "CQL": true,
        "CXL": true,
        "cds": true
    },
    "rules": {
        "no-console": "off"
    }
}
```

---

## cds block to merge

```json
"cds": {
    "requires": {
        "auth": {
            "kind": "xsuaa"
        },
        "db": {
            "kind": "hana",
            "model": "srv",
            "[development]": {
                "kind": "sqlite",
                "credentials": {
                    "database": ":memory:"
                }
            }
        }
    },
    "build": {
        "[node!]": {
            "target": "gen",
            "tasks": [
                { "for": "nodejs" },
                { "for": "typescript" },
                { "for": "hana" }
            ]
        },
        "[hana]": {
            "target": "gen",
            "tasks": [
                { "for": "hana" }
            ]
        }
    },
    "hana": {
        "syntax": "hdi",
        "deploy-format": "hdbtable",
        "journal": {
            "enable-drop": false,
            "change-mode": "alter"
        }
    },
    "odata": {
        "version": "v4"
    },
    "features": {
        "vector": true
    },
    "model": [
        "db",
        "srv"
    ]
}
```

> Remove `"for": "typescript"` task if project has no TypeScript.
> Remove `"features": { "vector": true }` if project doesn't use vector embeddings.

---

## devDependencies to ensure present

```json
"rimraf": "^5"
```

If `rimraf` is missing from devDependencies, remind user to run `npm install` after scaffolding.
