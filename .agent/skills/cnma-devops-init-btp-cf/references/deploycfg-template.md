# .deploycfg Template

Variables: `{{APP_UNDERSCORE}}` `{{APP_HYPHEN}}` `{{APP_DISPLAY}}`

Creates 3 files under `.deploycfg/`:

---

## 1. `.deploycfg/{{APP_HYPHEN}}.json`

BTP Extension destination JSON — used to register a destination in BTP for the deployed service.

```json
{
  "destination": {
    "Authentication": "NoAuthentication",
    "Description": "CNMA {{APP_DISPLAY}} Service",
    "HTML5.DynamicDestination": "true",
    "HTML5.ForwardAuthToken": "true",
    "HTML5.Timeout": "600000",
    "Name": "{{APP_HYPHEN}}",
    "ProxyType": "Internet",
    "Type": "HTTP",
    "URL": "space_app_url",
    "URL.headers.Authorization": "Bearer space_app_token"
  }
}
```

---

## 2. `.deploycfg/cpea.mtaext`

MTA extension for CPEA (Cloud Platform Enterprise Agreement) environment.

```yaml
_schema-version: "3.1"
ID: {{APP_UNDERSCORE}}-cpea
extends: {{APP_UNDERSCORE}}

# resources:
#   - name: {{APP_UNDERSCORE}}_objectstore
#     parameters:
#       service-plan: standard   # cpea: standard
```

---

## 3. `.deploycfg/payg.mtaext`

MTA extension for PAYG (Pay-As-You-Go) environment.

```yaml
_schema-version: "3.1"
ID: {{APP_UNDERSCORE}}-payg
extends: {{APP_UNDERSCORE}}

# resources:
#   - name: {{APP_UNDERSCORE}}_objectstore
#     parameters:
#       service-plan: standard   # payg: standard
```

---

## Notes

- The `.mtaext` files are used with `cf deploy ... -e .deploycfg/payg.mtaext` to override resource plans per environment
- Uncomment the `resources` block inside `.mtaext` files if the service plan differs between environments
- `{{APP_HYPHEN}}.json` is the destination descriptor used on BTP Cockpit
