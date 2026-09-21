# xs-security.json Template

Variables: `{{APP_UNDERSCORE}}` `{{APP_HYPHEN}}` `{{APP_DISPLAY}}` `{{APP_SCOPE_PREFIX}}`

`{{APP_SCOPE_PREFIX}}` = uppercase app name with underscores, e.g. `AI_DOC` for `ai_doc`.
Scopes follow pattern: `CNMA_{{APP_SCOPE_PREFIX}}_READ`, `CNMA_{{APP_SCOPE_PREFIX}}_WRITE`.
Always also include shared scopes: `CNMA_CUST_ADMIN`, `CNMA_CUST_SUPER_ADMIN`.

---

```json
{
    "xsappname": "{{APP_HYPHEN}}",
    "tenant-mode": "dedicated",
    "scopes": [
        {
            "name": "$XSAPPNAME.CNMA_{{APP_SCOPE_PREFIX}}_READ",
            "description": "{{APP_DISPLAY}}: Read access"
        },
        {
            "name": "$XSAPPNAME.CNMA_{{APP_SCOPE_PREFIX}}_WRITE",
            "description": "{{APP_DISPLAY}}: Write / manage access"
        },
        {
            "name": "$XSAPPNAME.CNMA_CUST_ADMIN",
            "description": "CNMA Customer Admin"
        },
        {
            "name": "$XSAPPNAME.CNMA_CUST_SUPER_ADMIN",
            "description": "CNMA Customer Super Admin"
        }
    ],
    "foreign-scope-references": [],
    "attributes": [],
    "role-templates": [
        {
            "name": "CNMA_{{APP_SCOPE_PREFIX}}_USER",
            "description": "{{APP_DISPLAY}} User — read access",
            "scope-references": [
                "$XSAPPNAME.CNMA_{{APP_SCOPE_PREFIX}}_READ"
            ],
            "attribute-references": []
        },
        {
            "name": "CNMA_{{APP_SCOPE_PREFIX}}_ADMIN",
            "description": "{{APP_DISPLAY}} Admin — full access",
            "scope-references": [
                "$XSAPPNAME.CNMA_{{APP_SCOPE_PREFIX}}_READ",
                "$XSAPPNAME.CNMA_{{APP_SCOPE_PREFIX}}_WRITE"
            ],
            "attribute-references": []
        }
    ],
    "oauth2-configuration": {
        "redirect-uris": [
            "https://*.applicationstudio.cloud.sap/**",
            "https://*.cfapps.eu10.hana.ondemand.com/",
            "https://*.cfapps.eu10-004.hana.ondemand.com/"
        ],
        "credential-types": [
            "binding-secret",
            "x509"
        ]
    }
}
```

---

## Merge Notes

If `xs-security.json` already exists:
- Preserve existing scopes — only add missing ones
- Never remove existing role-templates
- Keep existing `xsappname` if already set correctly
- Merge `redirect-uris` arrays (no duplicates)
