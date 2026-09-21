# Pipeline Files Template

Variables: `{{APP_UNDERSCORE}}` `{{APP_HYPHEN}}` `{{APP_UPPER}}` `{{APP_DISPLAY}}` `{{MTAR}}`

Creates 2 files: `Jenkinsfile` and `.pipeline/config.yml`

---

## Jenkinsfile

Pattern: latest CNMA refactored Jenkinsfile (26/02/2026)
Key features: centralized `sendTeamsNotification()`, `stageErrorNotified` flag, `deployParams` map, `finally` block, `MS_TEAM_DEPLOY_WEBHOOK_ENDPOINT`.

```groovy
#!/usr/bin/env groovy

/**
 * Custom deploy pipeline for Jenkins & SAP Piper Shared Library
 * The pipeline helps you to deliver software changes quickly and in a reliable manner.
 * A suitable Jenkins instance is required to run the pipeline.
 * More information on getting started with Continuous Delivery can be found here: https://sap.github.io/jenkins-library/
 * Refer https://www.project-piper.io/configuration/
 * created by: TinhLeo
 * created Date: 05/09/2023
 * Change logs:
 *  - 05/09/2023 (Tinh Leo): Initial version
 *  - 17/10/2024 (Tinh Leo): catch error on each stage and send noti to teams, also set color for each type of status for easy to track
 *  - 26/02/2026 (Tinh Leo): Refactor — centralized sendTeamsNotification, deduplicated try-catch, added Console Logs link
 *  - [DATE] (Tinh Leo): Apply to {{APP_UNDERSCORE}}
 **/

import groovy.json.JsonSlurperClassic
import groovy.json.internal.LazyMap

// ─── Constants ───────────────────────────────────────────────────────
def COLOR_SUCCESS = '#78b037'
def COLOR_ERROR   = '#d54c53'
def COLOR_INFO    = '#be7602'
def COLOR_WARN    = '#e8a317'

// ─── Pipeline Variables ──────────────────────────────────────────────
def branch = "${env.BRANCH_NAME}"
def author = "${env.CHANGE_AUTHOR}"

String[] allowBranches = ['develop', 'develop_sprint', 'develop_payasyougo', 'qas_internal', 'qas_external', 'prd_external']
def teamWebHookEndpoint = "${env.MS_TEAM_DEPLOY_WEBHOOK_ENDPOINT}"
def environment = 'CNMA {{APP_DISPLAY}} — Development'
def configApiEndpoint = "${env.DEPLOY_TARGET_{{APP_UPPER}}}"
def deployTargetCfg
def aCustomerTarges

@Library('piper-lib-os') _

// ─── Centralized Notification Function ───────────────────────────────
/**
 * Sends a formatted notification to Microsoft Teams with context info and Console Logs link.
 *
 * @param webhookUrl   MS Teams webhook URL
 * @param statusText   Short status label (e.g. 'Build Failure', 'Deployed Successfully')
 * @param messageText  Detail message body
 * @param colorCode    Hex color code for the notification card border
 */
def sendTeamsNotification(String webhookUrl, String statusText, String messageText, String colorCode) {
    def consoleUrl = "${env.BUILD_URL}console"
    def authorName = env.CHANGE_AUTHOR ?: 'Auto/System'

    def emoji = '🔔'
    if (colorCode == '#d54c53') {
        emoji = '❌'
    } else if (colorCode == '#78b037') {
        emoji = '✅'
    } else if (colorCode == '#be7602') {
        emoji = '⏳'
    } else if (colorCode == '#e8a317') {
        emoji = '⚠️'
    }

    def fullMessage = """${emoji} **${statusText}**
**📝 Job:** ${env.JOB_NAME} **#${env.BUILD_NUMBER}**
**🌿 Branch:** ${env.BRANCH_NAME} | **👤 By:** ${authorName}

**💬 Detail:**
${messageText}

[🔍 View Console Logs](${consoleUrl})
"""

    office365ConnectorSend(
        webhookUrl: webhookUrl,
        message: fullMessage,
        status: statusText,
        color: colorCode
    )
}

// ─── Validation Helpers ──────────────────────────────────────────────

def isValidDeployTarget(aTargets) {
    def isValidTarget = true
    aTargets.each { target ->
        target.each { key, value ->
            if (value == null) {
                echo "Found null value for property ${key}"
                isValidTarget = false
            } else if (value instanceof String) {
                if (value.trim().isEmpty() || value.trim().toLowerCase() == 'null') {
                    echo "Found empty or 'null' string value for property ${key}"
                    isValidTarget = false
                }
            } else if (value instanceof Collection && value.isEmpty()) {
                echo "Found empty collection for property ${key}"
                isValidTarget = false
            } else if (value instanceof Map && value.isEmpty()) {
                echo "Found empty map for property ${key}"
                isValidTarget = false
            }
        }
    }
    return isValidTarget
}

@NonCPS
def fetchDeployConfigFromApi(apiUrl) {
    try {
        echo "Fetching Deploy Target Config from API: ${apiUrl}"
        def response = new URL(apiUrl).getText()
        if (response) {
            echo "Fetched Deploy Target: ${response}"
            def jsonSlurperCls = new JsonSlurperClassic()
            def targetCfgMap = jsonSlurperCls.parseText(response)
            return targetCfgMap
        }
        error("Error when fetching target - Msg: Empty Config")
        return [:]
    } catch (err) {
        error("Error when fetching target - Msg: ${err.message}")
        return [:]
    }
}

// ─── Pipeline ────────────────────────────────────────────────────────

node() {
    if (!allowBranches.contains(branch)) {
        echo "Branch '${branch}' is not in allowBranches. Skipping pipeline."
        return
    }

    // Track whether an error notification was already sent by a stage,
    // so the outer catch doesn't send a duplicate.
    def stageErrorNotified = false

    try {
        // ── Stage 1: Prepare ─────────────────────────────────
        stage('Prepare Pipeline Data & Config') {
            sendTeamsNotification(teamWebHookEndpoint,
                'Pipeline Started',
                "Pulling latest source and setting up pipeline config from **{{APP_UNDERSCORE}}**...",
                COLOR_INFO)

            deleteDir()
            checkout scm

            deployTargetCfg = fetchDeployConfigFromApi(configApiEndpoint)
            echo "Fetched Deploy Config on Prepare Stage: ${deployTargetCfg}"

            if (deployTargetCfg.isEmpty()) {
                stageErrorNotified = true
                def msg = "Cannot get Deploy Target Config from API. Please check the config endpoint: `${configApiEndpoint}`"
                sendTeamsNotification(teamWebHookEndpoint, 'Prepare Stage Error', msg, COLOR_ERROR)
                error(msg)
            }

            // Default: develop_payasyougo
            aCustomerTarges = deployTargetCfg.develop_payasyougo

            switch (branch) {
                case 'develop_sprint':
                    environment = 'CNMA {{APP_DISPLAY}} — Development Sprint'
                    aCustomerTarges = deployTargetCfg.develop_sprint
                    break
                case 'qas_internal':
                    environment = 'CNMA {{APP_DISPLAY}} — QAS Internal'
                    aCustomerTarges = deployTargetCfg.qas_internal
                    break
                case 'qas_external':
                    environment = 'CNMA {{APP_DISPLAY}} — QAS External Multi-Customer'
                    aCustomerTarges = deployTargetCfg.qas_external
                    break
                case 'prd_external':
                    environment = 'CNMA {{APP_DISPLAY}} — PRODUCTION Multi-Customer'
                    aCustomerTarges = deployTargetCfg.prd_external
                    break
            }

            setupCommonPipelineEnvironment script: this
        }

        // ── Stage 2: Validate Targets ────────────────────────
        stage('Check Deploy Target') {
            echo "Validating deploy targets for branch: ${branch} → ${environment}..."

            if (aCustomerTarges == null || aCustomerTarges.isEmpty()) {
                stageErrorNotified = true
                def msg = "No deploy targets maintained for branch **${branch}**. Please configure targets on [cnma.tinhtd.info](https://cnma.tinhtd.info)."
                sendTeamsNotification(teamWebHookEndpoint, 'No Deploy Targets', msg, COLOR_ERROR)
                error(msg)
            }
            if (!isValidDeployTarget(aCustomerTarges)) {
                stageErrorNotified = true
                def msg = "Some deploy target properties have invalid values for **${environment}**. Please double-check on [cnma.tinhtd.info](https://cnma.tinhtd.info)."
                sendTeamsNotification(teamWebHookEndpoint, 'Invalid Deploy Targets', msg, COLOR_ERROR)
                error(msg)
            }

            echo "✅ Deploy targets validated: ${aCustomerTarges.size()} target(s) found for ${environment}"
        }

        // ── Stage 3: Build MTA ───────────────────────────────
        stage('Build') {
            try {
                echo "Building MTA — {{MTAR}}"
                mtaBuild script: this
            } catch (err) {
                stageErrorNotified = true
                def msg = "MTA Build failed.\n**Error:** `${err.message}`"
                sendTeamsNotification(teamWebHookEndpoint, 'Build Failed', msg, COLOR_ERROR)
                throw err
            }
        }

        // ── Stage 4: Deploy (Parallel per Target) ────────────
        echo "Deploying on environment: ${environment}"
        def jobStages = [:]
        jobStages.failFast = false

        aCustomerTarges.each { target ->
            jobStages["${target.display}"] = {
                stage("Deploy ${target.display}") {
                    try {
                        def deployParams = [
                            script:          this,
                            deployType:      'standard',
                            apiEndpoint:     target.apiCF,
                            cfOrg:           "\"${target.orgName}\"",
                            cfSpace:         target.space,
                            cfCredentialsId: target.credentialsId,
                            deployTool:      'mtaDeployPlugin'
                        ]

                        if (target.mtaExtensionDescriptor?.trim()) {
                            echo "Deploying with mtaExtensionDescriptor: ${target.mtaExtensionDescriptor}"
                            deployParams.mtaExtensionDescriptor = target.mtaExtensionDescriptor
                        } else {
                            echo "Deploying without mtaExtensionDescriptor"
                        }

                        cloudFoundryDeploy(deployParams)

                        sendTeamsNotification(teamWebHookEndpoint,
                            "Deployed ${target.display}",
                            "Application deployed to **Org:** ${target.orgName} | **Space:** ${target.space} | **Target:** ${target.display}",
                            COLOR_SUCCESS)

                    } catch (err) {
                        stageErrorNotified = true
                        def msg = """Deploy failed at target **${target.display}**.
**Org:** ${target.orgName} | **Space:** ${target.space}
**CF Error (truncated):** `${err.message}`

> The exact error log is often truncated by the CF CLI. Click **View Console Logs** below to see the full red lines."""
                        sendTeamsNotification(teamWebHookEndpoint, "Deploy Failed — ${target.display}", msg, COLOR_ERROR)
                        throw err
                    }
                }
            }
        }

        parallel jobStages

    } catch (err) {
        currentBuild.result = 'FAILURE'

        // Only send a generic error if no stage already sent a specific one
        if (!stageErrorNotified) {
            def msg = """An unexpected error occurred in the pipeline.
**Error:** `${err.message ?: 'Unknown error — see Console Logs'}`"""
            sendTeamsNotification(teamWebHookEndpoint, 'Pipeline Failed', msg, COLOR_ERROR)
        }

    } finally {
        // Always clean workspace & send a final summary if the build succeeded
        if (currentBuild.result != 'FAILURE') {
            sendTeamsNotification(teamWebHookEndpoint,
                'Pipeline Completed',
                "All stages finished successfully for **${environment}**.",
                COLOR_SUCCESS)
        }
        cleanWs()
    }
}
```

### Substitution notes

| Placeholder | Example |
|---|---|
| `{{APP_UNDERSCORE}}` | `cnma_ai_doc` |
| `{{APP_DISPLAY}}` | `AI Document` |
| `{{APP_UPPER}}` | `AI_DOC` → Jenkins env var becomes `DEPLOY_TARGET_AI_DOC` |
| `{{MTAR}}` | `cnma_ai_doc_1.0.0.mtar` |
| `[DATE]` in Change logs | current date as `DD/MM/YYYY` |

### Required Jenkins environment variables

| Variable | Purpose |
|---|---|
| `MS_TEAM_DEPLOY_WEBHOOK_ENDPOINT` | MS Teams webhook for notifications |
| `DEPLOY_TARGET_{{APP_UPPER}}` | API endpoint returning deploy target JSON config |

---

## .pipeline/config.yml

```yaml
# SAP Piper Shared Library pipeline config
# Ref: https://github.com/SAP/jenkins-library/blob/master/resources/default_pipeline_environment.yml
general:
    buildTool: "mta"
service:
    buildToolVersion: "MBTJ11N20"
stages:
    Build:
        mavenExecuteStaticCodeChecks: false
        npmExecuteLint: true
steps:
    artifactPrepareVersion:
        versioningType: "cloud_noTag"
    npmExecuteLint:
        failOnError: true
    mtaBuild:
        dockerOptions: "--env HOME=/tmp/mta"
        buildTarget: "CF"
        mtaFilePath: "mta_archives/{{MTAR}}"
        mtarName: "{{MTAR}}"
        dockerImage: devxci/mbtci-java11-node20
    piperStageWrapper:
        projectExtensionsDirectory: ".pipeline/extensions/"
```
