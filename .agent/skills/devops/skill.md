---
name: devops
description: Managing the Path-to-Production, Infrastructure, and Automation.
---

# 🛣️ DevOps & Platform Engineering Skill

**Context:** Use this skill package for Deployment, Infrastructure, and CI/CD.

## 1. The Platform
*   **Cloud:** SAP Business Technology Platform (BTP)
*   **Runtime:** Cloud Foundry / Kyma
*   **IaC:** MTA / Terraform

## 2. Reference Modules
- **[BTP Infrastructure Management](./resources/btp-infrastructure-management.md)**: Subaccounts, Entitlements, Destinations.
- **[MTA Configuration](./resources/mta-configuration.md)**: The build descriptor (`mta.yaml`).
- **[CI/CD Pipelines](./resources/ci-cd-pipelines.md)**: GitHub Actions / Azure DevOps workflows.

## 3. Best Practices
*   **Immutable Artifacts:** Build once (MTAR), deploy everywhere.
*   **Least Privilege:** Service Keys and Roles should be minimal.
*   **Observability:** Enable Application Logging and Alerting.
