# mta.yaml Template

Variables: `{{APP_UNDERSCORE}}` `{{APP_HYPHEN}}` `{{APP_DOT}}` `{{APP_UPPER}}` `{{MTAR}}`

Type `full` includes DB + SRV + UI + UIDeployer + DestinationContent.
Type `srv-only` omits UI and UIDeployer modules.
`--objectstore` flag includes the Object Store resource and SRV binding.
`--aicore` flag includes the AI Core resource and SRV binding.

---

## Full Type (default)

```yaml
_schema-version: "3.1"
ID: {{APP_UNDERSCORE}}
version: 1.0.0
description: "CNMA {{APP_DISPLAY}} Service"
parameters:
    enable-parallel-deployments: true

build-parameters:
    before-all:
        - builder: custom
          commands:
              - npm install
              - npm run clean
              - npm run build:ts
              - npm run build

# = = = = = = = = = = = = = = = = = = = = = = = = = = MODULE SPACE = = = = = = = = = = = = = = = = = = = = = = = = = = #
modules:
    # ------------------------------------------------------------
    # (1) DB MODULE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_db
      type: hdb
      path: db
      parameters:
          buildpack: nodejs_buildpack
          disk-quota: 512M
          memory: 256M
          no-route: true
          no-start: true
          tasks:
              - name: hdi-deploy
                command: npm run start-update
      build-parameters:
          builder: custom
          commands: []
          ignore: ["node_modules", "default-env.json"]
      requires:
          - name: {{APP_UNDERSCORE}}_hdi
          - name: {{APP_UNDERSCORE}}_xsuaa

    # ------------------------------------------------------------
    # (2) SERVICE MODULE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_srv
      type: nodejs
      path: gen/srv
      parameters:
          buildpack: nodejs_buildpack
          memory: 1024M
          disk-quota: 2048M
          stack: cflinuxfs4
          env:
              OPTIMIZE_MEMORY: true
      build-parameters:
          builder: custom
          commands: []
          ignore:
              - node_modules
              - default-env.json
              - mta_archives
              - db/node_modules
              - app/node_modules
              - app/dist
              - docs
              - .env
              - .env.local
      provides:
          - name: srv-api
            public: true
            properties:
                srv-url: ${default-url}
      requires:
          - name: {{APP_UNDERSCORE}}_hdi
          - name: {{APP_UNDERSCORE}}_xsuaa
          - name: {{APP_UNDERSCORE}}_destination
          - name: {{APP_UNDERSCORE}}_connectivity
          - name: {{APP_UNDERSCORE}}_applog
          # [OBJECTSTORE] - name: {{APP_UNDERSCORE}}_objectstore
          # [AICORE] - name: {{APP_UNDERSCORE}}_aicore

    # ------------------------------------------------------------
    # (3) UI MODULE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_ui
      type: html5
      path: app
      requires:
          - name: {{APP_UNDERSCORE}}_destination
      build-parameters:
          ignore: [".dev", "node_modules", "default-env.json"]
          build-result: dist
          builder: custom
          commands:
              - npm install
              - npm run build:cf
          supported-platforms: []
      parameters:
          version: ${version}-${timestamp}

    # ------------------------------------------------------------
    # (4) UI DEPLOYER MODULE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_ui_deployer
      type: com.sap.application.content
      path: .
      requires:
          - name: {{APP_UNDERSCORE}}_html5_host
            parameters:
                content-target: true
      build-parameters:
          ignore: ["node_modules", "default-env.json"]
          build-result: ui_resources
          requires:
              - artifacts:
                    - {{APP_UNDERSCORE}}.zip
                name: {{APP_UNDERSCORE}}_ui
                target-path: ui_resources/

    # ------------------------------------------------------------
    # (5) DESTINATION CONTENT MODULE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_destination_content
      type: com.sap.application.content
      requires:
          - name: {{APP_UNDERSCORE}}_xsuaa
            parameters:
                service-key:
                    name: {{APP_UNDERSCORE}}_xsuaa_key
          - name: {{APP_UNDERSCORE}}_html5_host
            parameters:
                service-key:
                    name: {{APP_UNDERSCORE}}_html5_host_key
          - name: {{APP_UNDERSCORE}}_destination
            parameters:
                content-target: true
          - name: {{APP_UNDERSCORE}}_connectivity
      parameters:
          content:
              instance:
                  existing_destinations_policy: update
                  destinations:
                      - Name: {{APP_UNDERSCORE}}_html5_dest
                        ServiceInstanceName: {{APP_UNDERSCORE}}_html5_host
                        ServiceKeyName: {{APP_UNDERSCORE}}_html5_host_key
                        sap.cloud.service: {{APP_DOT}}

                      - Name: {{APP_UNDERSCORE}}_xsuaa_dest
                        Authentication: OAuth2UserTokenExchange
                        ServiceInstanceName: {{APP_UNDERSCORE}}_xsuaa
                        ServiceKeyName: {{APP_UNDERSCORE}}_xsuaa_key
                        sap.cloud.service: {{APP_DOT}}
      build-parameters:
          no-source: true

# = = = = = = = = = = = = = = = = = = = = = = = = = = RESOURCE SPACE = = = = = = = = = = = = = = = = = = = = = = = = = = #
resources:
    # ------------------------------------------------------------
    # (1) HDI CONTAINER INSTANCE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_hdi
      type: com.sap.xs.hdi-container
      properties:
          hdi-container-name: "${service-name}"
      parameters:
          service: hana
          service-plan: hdi-shared

    # ------------------------------------------------------------
    # (2) XSUAA RESOURCE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_xsuaa
      type: org.cloudfoundry.managed-service
      parameters:
          path: ./xs-security.json
          service: xsuaa
          service-plan: application

    # ------------------------------------------------------------
    # (3) HTML5 APP REPOSITORY
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_html5_host
      type: org.cloudfoundry.managed-service
      parameters:
          service: html5-apps-repo
          service-plan: app-host

    # [OBJECTSTORE] -----------------------------------------------
    # (4) OBJECT STORE (S3-compatible for file uploads)
    # ------------------------------------------------------------
    # - name: {{APP_UNDERSCORE}}_objectstore
    #   type: org.cloudfoundry.managed-service
    #   parameters:
    #       service: objectstore
    #       service-plan: standard

    # [AICORE] ----------------------------------------------------
    # (4/5) AI CORE
    # ------------------------------------------------------------
    # - name: {{APP_UNDERSCORE}}_aicore
    #   type: org.cloudfoundry.managed-service
    #   parameters:
    #       service: aicore
    #       service-plan: extended

    # ------------------------------------------------------------
    # (N-2) APPLICATION LOGGING
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_applog
      type: org.cloudfoundry.managed-service
      parameters:
          service-name: {{APP_UNDERSCORE}}_applog
          service: application-logs
          service-plan: lite

    # ------------------------------------------------------------
    # (N-1) CONNECTIVITY
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_connectivity
      type: org.cloudfoundry.managed-service
      parameters:
          service: connectivity
          service-plan: lite

    # ------------------------------------------------------------
    # (N) DESTINATION SERVICE
    # ------------------------------------------------------------
    - name: {{APP_UNDERSCORE}}_destination
      type: org.cloudfoundry.managed-service
      requires:
          - name: srv-api
      parameters:
          service-plan: lite
          service: destination
          forwardAuthToken: true
          config:
              forwardAuthToken: true
              HTML5Runtime_enabled: true
              init_data:
                  instance:
                      existing_destinations_policy: ignore
                      destinations:
                          - Name: {{APP_UNDERSCORE}}_srv_dest
                            Authentication: NoAuthentication
                            Description: CNMA {{APP_DISPLAY}} Service Backend
                            ProxyType: Internet
                            Type: HTTP
                            URL: ~{srv-api/srv-url}
                            HTML5.DynamicDestination: true
                            HTML5.ForwardAuthToken: true
                            HTML5.Timeout: 600000
```

---

## srv-only Type

Same as full but without modules `(3) UI MODULE` and `(4) UI DEPLOYER MODULE`.
Also remove `{{APP_UNDERSCORE}}_html5_host` from resources — it is not needed.
Keep `{{APP_UNDERSCORE}}_destination_content` but remove `html5_host` requires from it.

---

## Conditional Sections

When `--objectstore` is specified:
- Uncomment `[OBJECTSTORE]` resource block
- Add `- name: {{APP_UNDERSCORE}}_objectstore` to SRV requires list

When `--aicore` is specified:
- Uncomment `[AICORE]` resource block
- Add `- name: {{APP_UNDERSCORE}}_aicore` to SRV requires list
